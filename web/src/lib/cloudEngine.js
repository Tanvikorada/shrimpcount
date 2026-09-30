// The sync engine. Pure logic, no network and no browser, so it can be tested thoroughly.
//
// The phone is the working copy and keeps working offline. To back up and to share records between phones we keep, for every
// record, the fingerprint (hash) of the version last agreed with the cloud. Then:
//   - a record whose fingerprint changed since then has a local change to upload;
//   - a record that was agreed once and is now gone locally was deleted here, so a "deleted" marker is uploaded;
//   - records that changed in the cloud are downloaded, unless the same record was also changed here.
// If both sides changed the same record, the local version wins and is uploaded, so nobody's unsaved work is thrown away.
// (The phone that syncs last wins, and the other phone picks it up on its next sync.)

export const COLLECTIONS = ['batches', 'samples', 'events', 'orders', 'water', 'inventory', 'tasks', 'quality', 'tests', 'prices', 'growth']
// Settings shared across the team's phones. Language, text size and the "extra tools" switch stay personal to each phone.
export const SHARED_SETTINGS = ['hatchery', 'operator', 'ranges']
const PUSH_BATCH = 200
const OVERLAP_MS = 60000 // re-ask for the last minute on every pull, so a row committed slightly late is never missed

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}
/** A short fingerprint of a record's content (djb2 over the stable text). Equal content gives an equal fingerprint. */
export function hashOf(value) {
  const s = stable(value)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${(h >>> 0).toString(36)}.${s.length}`
}

const keyOf = (collection, id) => `${collection}:${id}`

/** Every record on this phone as Map<key, { collection, id, data }>. Settings are one record. */
export function collect(state) {
  const out = new Map()
  for (const c of COLLECTIONS) {
    for (const r of state[c] || []) if (r && r.id != null) out.set(keyOf(c, r.id), { collection: c, id: String(r.id), data: r })
  }
  const shared = {}
  for (const k of SHARED_SETTINGS) if (state.settings && state.settings[k] !== undefined) shared[k] = state.settings[k]
  out.set(keyOf('settings', 'main'), { collection: 'settings', id: 'main', data: shared })
  return out
}

export const emptyMeta = (hatcheryId) => ({ hatcheryId, cursor: null, keys: {} })

/** Decide what to do with rows just downloaded. Returns what to apply locally, the updated meta, and how many clashes. */
export function planPull(current, meta, rows) {
  const keys = { ...meta.keys }
  const upserts = []
  const deletes = []
  let conflicts = 0
  let cursor = meta.cursor

  for (const r of rows) {
    if (!cursor || r.updated_at > cursor) cursor = r.updated_at
    const key = keyOf(r.collection, r.id)
    const L = current.get(key)
    const known = keys[key]
    const remoteHash = r.deleted ? null : hashOf(r.data)
    // "changed here" = it exists and differs from the agreed version, or it was agreed once and is now gone
    const changedHere = L ? hashOf(L.data) !== known : known !== undefined
    // a settings record always exists locally, so "changed here" only when it differs from the agreed version

    // First contact of a phone with the team's settings: the team's saved values win over this phone's blank defaults
    // (otherwise a new phone would upload empty settings over the real ones). If the cloud has none, ours are uploaded.
    if (r.collection === 'settings' && known === undefined && !r.deleted) {
      const d = r.data || {}
      if (d.hatchery || d.operator || Object.keys(d.ranges || {}).length) { upserts.push({ collection: 'settings', id: r.id, data: r.data }); keys[key] = remoteHash; continue }
    }

    if (r.deleted) {
      if (L && !changedHere) { deletes.push({ collection: r.collection, id: r.id }); delete keys[key] }
      else if (L && changedHere) conflicts++ // edited here but deleted elsewhere: keep ours, it is uploaded again
      else delete keys[key]
      continue
    }
    if (!L && known === undefined) { upserts.push({ collection: r.collection, id: r.id, data: r.data }); keys[key] = remoteHash; continue }
    if (!L) { // agreed once, deleted here since
      if (remoteHash === known) continue // nobody else touched it: our delete stands and is uploaded
      upserts.push({ collection: r.collection, id: r.id, data: r.data }); keys[key] = remoteHash; conflicts++ // someone edited it after we deleted: keep the edit
      continue
    }
    if (!changedHere) {
      if (remoteHash !== known) { upserts.push({ collection: r.collection, id: r.id, data: r.data }); keys[key] = remoteHash }
      continue
    }
    if (hashOf(L.data) === remoteHash) { keys[key] = remoteHash; continue } // both sides made the same change
    conflicts++ // changed on both sides: ours wins and is uploaded
  }
  return { upserts, deletes, conflicts, meta: { ...meta, keys, cursor } }
}

/** What to upload now: changed or new records, and markers for records deleted here. */
export function planPush(current, meta) {
  const upserts = []
  for (const [key, rec] of current) {
    if (hashOf(rec.data) !== meta.keys[key]) upserts.push({ collection: rec.collection, id: rec.id, data: rec.data, deleted: false, _hash: hashOf(rec.data), _key: key })
  }
  const deletes = []
  for (const key of Object.keys(meta.keys)) {
    if (!current.has(key)) {
      const i = key.indexOf(':')
      deletes.push({ collection: key.slice(0, i), id: key.slice(i + 1), data: null, deleted: true, _key: key })
    }
  }
  return { upserts, deletes }
}

const newest = (r) => r.timestamp || r.createdAt || r.date || ''
/** Apply downloaded changes to the app's state (a pure function). New records go in newest-first like the rest of the app. */
export function applyPlan(state, plan) {
  const next = { ...state }
  const touched = new Set()
  for (const u of plan.upserts) {
    if (u.collection === 'settings') { next.settings = { ...next.settings, ...u.data }; continue }
    if (!COLLECTIONS.includes(u.collection)) continue
    const list = (next[u.collection] || []).filter((r) => String(r.id) !== u.id)
    next[u.collection] = [u.data, ...list]
    touched.add(u.collection)
  }
  for (const d of plan.deletes) {
    if (!COLLECTIONS.includes(d.collection)) continue
    next[d.collection] = (next[d.collection] || []).filter((r) => String(r.id) !== d.id)
  }
  for (const c of touched) next[c] = [...next[c]].sort((a, b) => String(newest(b)).localeCompare(String(newest(a))))
  return next
}

/**
 * One full round: download what changed, merge, upload what changed here.
 * adapter: { pull(hatcheryId, since) -> rows[], push(hatcheryId, rows) }
 * io: { getState(), applyRemote(plan), loadMeta(hatcheryId), saveMeta(meta) }
 */
export async function syncOnce({ adapter, hatcheryId, io }) {
  let meta = io.loadMeta(hatcheryId) || emptyMeta(hatcheryId)
  const since = meta.cursor ? new Date(new Date(meta.cursor).getTime() - OVERLAP_MS).toISOString() : null

  const rows = await adapter.pull(hatcheryId, since)
  const plan = planPull(collect(io.getState()), meta, rows)
  if (plan.upserts.length || plan.deletes.length) io.applyRemote(plan)
  meta = plan.meta
  io.saveMeta(meta)

  const { upserts, deletes } = planPush(collect(io.getState()), meta)
  const all = [...upserts, ...deletes]
  for (let i = 0; i < all.length; i += PUSH_BATCH) {
    const chunk = all.slice(i, i + PUSH_BATCH)
    await adapter.push(hatcheryId, chunk.map(({ collection, id, data, deleted }) => ({ collection, id, data, deleted })))
    const keys = { ...meta.keys }
    for (const c of chunk) { if (c.deleted) delete keys[c._key]; else keys[c._key] = c._hash }
    meta = { ...meta, keys }
    io.saveMeta(meta) // progress is kept even if the next chunk fails
  }
  return { pulled: rows.length, applied: plan.upserts.length + plan.deletes.length, conflicts: plan.conflicts, pushed: all.length }
}
