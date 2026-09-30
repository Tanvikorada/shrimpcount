// Accounts and cloud backup, on Supabase. The app works fully without any of this; when it is switched on (the two values
// below are set) a signed-in person's records are backed up and shared with their team's phones. All the merge logic is in
// cloudEngine.js. This file is the thin layer that talks to Supabase and reports status.
import { useEffect, useState } from 'react'
import { syncOnce } from './cloudEngine'
import { applyRemote, getState, subscribeStore } from './store'
import { evidenceGet, evidenceKeys, setEvidenceFallback } from './evidence'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const cloudConfigured = !!(URL && KEY)

const META_KEY = 'shrimpcount.cloud.meta'
const LAST_KEY = 'shrimpcount.cloud.last'
const UP_KEY = 'shrimpcount.cloud.photos'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage may be blocked */ } }

// ---------- state everyone can watch ----------
let view = { ready: !cloudConfigured, user: null, hatchery: null, role: null, members: [], status: 'idle', lastSync: read(LAST_KEY, null), error: '', conflicts: 0 }
const watchers = new Set()
const set = (patch) => { view = { ...view, ...patch }; watchers.forEach((f) => f()) }
export function useCloud() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((n) => n + 1); watchers.add(f); return () => watchers.delete(f) }, [])
  return view
}

// ---------- the Supabase client (loaded only when needed, so it costs nothing when switched off) ----------
let clientP = null
const client = () => (clientP ??= import('@supabase/supabase-js').then((m) => m.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shrimpcount.auth' } })))

const isNetworkError = (e) => !navigator.onLine || /failed to fetch|network|load failed|fetch/i.test(String(e?.message || e))

// ---------- account ----------
export async function signUp(email, password) {
  const sb = await client()
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password })
  if (error) throw error
  return { needsConfirm: !data.session }
}
export async function signIn(email, password) {
  const sb = await client()
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}
export async function signOut() {
  const sb = await client()
  await sb.auth.signOut()
  try { localStorage.removeItem(META_KEY); localStorage.removeItem(LAST_KEY); localStorage.removeItem(UP_KEY) } catch { /* ignore */ }
  set({ user: null, hatchery: null, role: null, members: [], status: 'idle', lastSync: null, error: '' })
}

async function refreshHatchery() {
  const sb = await client()
  const uid = view.user?.id
  if (!uid) return
  const { data, error } = await sb.from('members').select('role, hatchery_id, hatcheries ( id, name, invite_code )').eq('user_id', uid).limit(1)
  if (error) throw error
  const m = data?.[0]
  if (!m) { set({ hatchery: null, role: null, members: [] }); return }
  const { data: people } = await sb.from('members').select('email, role').eq('hatchery_id', m.hatchery_id)
  set({ hatchery: m.hatcheries, role: m.role, members: people || [] })
}
export async function createHatchery(name) {
  const sb = await client()
  const { error } = await sb.rpc('create_hatchery', { p_name: name })
  if (error) throw error
  await refreshHatchery(); syncSoon(300)
}
export async function joinHatchery(code) {
  const sb = await client()
  const { error } = await sb.rpc('join_hatchery', { p_code: code })
  if (error) throw error
  await refreshHatchery(); syncSoon(300)
}
export async function rotateInvite() {
  const sb = await client()
  const { error } = await sb.rpc('rotate_invite_code', { p_hatchery: view.hatchery.id })
  if (error) throw error
  await refreshHatchery()
}

// ---------- sync ----------
const adapter = {
  async pull(h, since) {
    const sb = await client()
    const out = []
    for (let from = 0; ; from += 1000) {
      let q = sb.from('records').select('collection, id, data, deleted, updated_at').eq('hatchery_id', h)
        .order('updated_at', { ascending: true }).order('collection').order('id').range(from, from + 999)
      if (since) q = q.gte('updated_at', since)
      const { data, error } = await q
      if (error) throw error
      out.push(...data)
      if (data.length < 1000) break
    }
    return out
  },
  async push(h, rows) {
    const sb = await client()
    const { error } = await sb.from('records').upsert(rows.map((r) => ({ hatchery_id: h, collection: r.collection, id: r.id, data: r.data, deleted: r.deleted })), { onConflict: 'hatchery_id,collection,id' })
    if (error) throw error
  },
}
const io = {
  getState,
  applyRemote,
  loadMeta: (h) => { const m = read(META_KEY, null); return m && m.hatcheryId === h ? m : null },
  saveMeta: (m) => write(META_KEY, m),
}

// The marked photos: uploaded a few at a time after the records, fetched on demand when a phone does not have one.
async function syncPhotos(h) {
  const sb = await client()
  const done = new Set(read(UP_KEY, []))
  const todo = (await evidenceKeys()).filter((id) => !done.has(id))
  for (const id of todo.slice(0, 8)) {
    const blob = await evidenceGet(id)
    if (!blob) continue
    const { error } = await sb.storage.from('evidence').upload(`${h}/${id}.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw error
    done.add(id)
    write(UP_KEY, [...done])
  }
  return todo.length > 8
}
setEvidenceFallback(async (id) => {
  if (!view.user || !view.hatchery || !navigator.onLine) return null
  const sb = await client()
  const { data } = await sb.storage.from('evidence').download(`${view.hatchery.id}/${id}.jpg`)
  if (data) write(UP_KEY, [...new Set([...read(UP_KEY, []), id])])
  return data || null
})

let running = false
let timer = null
export async function syncNow() {
  if (!cloudConfigured || !view.user || !view.hatchery || running) return
  if (!navigator.onLine) { set({ status: 'offline' }); return }
  running = true
  set({ status: 'syncing', error: '' })
  try {
    const r = await syncOnce({ adapter, hatcheryId: view.hatchery.id, io })
    const more = await syncPhotos(view.hatchery.id)
    const now = new Date().toISOString()
    write(LAST_KEY, now)
    set({ status: 'ok', lastSync: now, conflicts: view.conflicts + r.conflicts })
    if (more) syncSoon(1500)
  } catch (e) {
    set(isNetworkError(e) ? { status: 'offline' } : { status: 'error', error: String(e?.message || e) })
  } finally { running = false }
}
function syncSoon(ms = 6000) { clearTimeout(timer); timer = setTimeout(syncNow, ms) }

let started = false
export async function initCloud() {
  if (started) return
  started = true
  if (!cloudConfigured) { set({ ready: true }); return }
  const sb = await client()
  const { data } = await sb.auth.getSession()
  set({ user: data.session?.user || null })
  try { if (view.user) await refreshHatchery() } catch { /* offline: keep what we know */ }
  set({ ready: true })
  sb.auth.onAuthStateChange(async (_e, session) => {
    set({ user: session?.user || null })
    if (session?.user) { try { await refreshHatchery(); syncSoon(300) } catch { /* ignore */ } }
  })
  // when to sync: shortly after the person makes a change, when the signal returns, when the app is opened again, and now and then
  subscribeStore(() => { if (!running) syncSoon() })
  window.addEventListener('online', () => syncSoon(500))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(800) })
  setInterval(() => syncSoon(0), 5 * 60 * 1000)
  syncSoon(800)
}

// exposed for lib/admin.js: the owner-only dashboard needs the same Supabase client, for queries cloud.js has no reason to know about
export const sbClient = client
