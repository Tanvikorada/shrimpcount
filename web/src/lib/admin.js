// The owner-only dashboard's data layer. Every call here relies on the database's own rules (supabase/admin.sql), not on
// anything in this file, to keep a non-admin out - an admin's session can see every hatchery, everyone else still only
// sees their own. This file just shapes what comes back for the screen.
import { sbClient } from './cloud'

export async function isAdmin() {
  const sb = await sbClient()
  const { data } = await sb.auth.getUser()
  if (!data?.user) return false
  const { data: row } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle()
  return !!row
}

async function pageThrough(sb, build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb).range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

/** Every hatchery, who is in it, and how much counting it has done. Read-only except the three billing fields. */
export async function fetchDashboard() {
  const sb = await sbClient()
  const [hatcheries, members, samples] = await Promise.all([
    pageThrough(sb, (s) => s.from('hatcheries').select('id, name, invite_code, created_at, plan_status, paid_until, admin_notes').order('created_at', { ascending: false })),
    pageThrough(sb, (s) => s.from('members').select('hatchery_id, email, role')),
    pageThrough(sb, (s) => s.from('records').select('hatchery_id, deleted, updated_at').eq('collection', 'samples')),
  ])
  const byH = new Map(hatcheries.map((h) => [h.id, { ...h, members: [], counts: 0, countsToday: 0, lastActive: null }]))
  for (const m of members) byH.get(m.hatchery_id)?.members.push(m)
  const today = new Date().toDateString()
  for (const r of samples) {
    const h = byH.get(r.hatchery_id)
    if (!h) continue
    if (!r.deleted) { h.counts++; if (new Date(r.updated_at).toDateString() === today) h.countsToday++ }
    if (!h.lastActive || r.updated_at > h.lastActive) h.lastActive = r.updated_at
  }
  return [...byH.values()]
}

export async function updateBilling(hatcheryId, patch) {
  const sb = await sbClient()
  const { error } = await sb.from('hatcheries').update(patch).eq('id', hatcheryId)
  if (error) throw error
}
