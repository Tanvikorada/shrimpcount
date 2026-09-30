// Run: node --test web/src/lib/cloudEngine.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPlan, collect, hashOf, syncOnce } from './cloudEngine.js'

// An in-memory stand-in for the cloud: it stamps its own increasing time on every write, like the real database does.
function server() {
  const rows = new Map()
  let tick = 0
  const stamp = () => new Date(Date.UTC(2026, 8, 21, 10, 0, 0) + ++tick * 1000).toISOString()
  return {
    rows,
    pushes: 0,
    adapter: {
      async pull(_h, since) { return [...rows.values()].filter((r) => !since || r.updated_at >= since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)) },
      async push(_h, batch) { server.pushes++; for (const r of batch) rows.set(`${r.collection}:${r.id}`, { ...r, updated_at: stamp() }) },
    },
  }
}
// One phone: its own state and its own bookkeeping, talking to the shared server.
function phone(srv, initial = {}) {
  let state = { settings: { hatchery: '', operator: '', language: 'en', ranges: {} }, batches: [], samples: [], orders: [], ...initial }
  let meta = null
  const counter = { pushes: 0 }
  const adapter = { pull: srv.adapter.pull, push: async (h, b) => { counter.pushes++; return srv.adapter.push(h, b) } }
  return {
    get state() { return state },
    set state(s) { state = s },
    counter,
    sync: () => syncOnce({ adapter, hatcheryId: 'h1', io: { getState: () => state, applyRemote: (p) => { state = applyPlan(state, p) }, loadMeta: () => meta, saveMeta: (m) => { meta = m } } }),
  }
}
const sample = (id, count, timestamp = '2026-09-21T09:00:00Z') => ({ id, batchId: 'b1', count, timestamp })

test('hash: same content in a different key order is the same; different content is different', () => {
  assert.equal(hashOf({ a: 1, b: [1, 2] }), hashOf({ b: [1, 2], a: 1 }))
  assert.notEqual(hashOf({ a: 1 }), hashOf({ a: 2 }))
})

test('a new phone with records uploads them, and syncing again uploads nothing', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700), sample('s2', 1650)] })
  const r1 = await a.sync()
  assert.equal(r1.pushed, 3) // two samples + the shared settings
  assert.ok(s.rows.has('samples:s1') && s.rows.has('samples:s2'))
  const r2 = await a.sync()
  assert.equal(r2.pushed, 0)
  assert.equal(r2.applied, 0)
})

test('a second phone receives them (a new phone is restored from the cloud)', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)], batches: [{ id: 'b1', code: 'B-1', createdAt: '2026-09-20' }] })
  a.state = { ...a.state, settings: { ...a.state.settings, hatchery: 'Demo Hatchery', language: 'te' } }
  await a.sync()
  const b = phone(s)
  await b.sync()
  assert.deepEqual(b.state.samples.map((x) => x.id), ['s1'])
  assert.equal(b.state.batches[0].code, 'B-1')
  assert.equal(b.state.settings.hatchery, 'Demo Hatchery', 'shared setting arrives')
  assert.equal(b.state.settings.language, 'en', "one person's language is not forced on another phone")
})

test('an edit on one phone reaches the other', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] }); await a.sync()
  const b = phone(s); await b.sync()
  b.state = { ...b.state, samples: b.state.samples.map((x) => ({ ...x, count: 1710 })) }
  await b.sync(); await a.sync()
  assert.equal(a.state.samples[0].count, 1710)
})

test('a deletion reaches the other phone (via a deleted marker)', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700), sample('s2', 1650)] }); await a.sync()
  const b = phone(s); await b.sync()
  a.state = { ...a.state, samples: a.state.samples.filter((x) => x.id !== 's1') }
  await a.sync()
  assert.equal(s.rows.get('samples:s1').deleted, true)
  await b.sync()
  assert.deepEqual(b.state.samples.map((x) => x.id), ['s2'])
})

test('both phones edit the same count: the last to sync wins, both end the same, and it is reported', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] }); await a.sync()
  const b = phone(s); await b.sync()
  a.state = { ...a.state, samples: [{ ...a.state.samples[0], count: 1111 }] }
  b.state = { ...b.state, samples: [{ ...b.state.samples[0], count: 2222 }] }
  await a.sync()
  const rb = await b.sync()
  assert.equal(rb.conflicts, 1)
  await a.sync()
  assert.equal(a.state.samples[0].count, 2222)
  assert.equal(b.state.samples[0].count, 2222)
})

test('edited on one phone but deleted on the other: the edit is kept, never lost', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] }); await a.sync()
  const b = phone(s); await b.sync()
  a.state = { ...a.state, samples: [] }; await a.sync()                                   // A deletes
  b.state = { ...b.state, samples: [{ ...b.state.samples[0], count: 1800 }] }              // B edits before hearing about it
  const rb = await b.sync()
  assert.equal(rb.conflicts, 1)
  await a.sync()
  assert.equal(a.state.samples[0]?.count, 1800, 'the record comes back with the edit')
})

test('deleted offline while nobody else changed it: the deletion stands', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] }); await a.sync()
  a.state = { ...a.state, samples: [] }
  const r = await a.sync()
  assert.equal(r.conflicts, 0)
  assert.equal(s.rows.get('samples:s1').deleted, true)
  assert.equal(a.state.samples.length, 0)
})

test('two phones that each made different records end up with all of them', async () => {
  const s = server(); const a = phone(s, { samples: [sample('a1', 1)] }); const b = phone(s, { samples: [sample('b1', 2)] })
  await a.sync(); await b.sync(); await a.sync()
  assert.deepEqual(a.state.samples.map((x) => x.id).sort(), ['a1', 'b1'])
  assert.deepEqual(b.state.samples.map((x) => x.id).sort(), ['a1', 'b1'])
})

test('a failed upload is retried and nothing is lost or duplicated', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] })
  let fail = true
  const flaky = { pull: s.adapter.pull, push: async (h, b) => { if (fail) throw new Error('no signal'); return s.adapter.push(h, b) } }
  let meta = null
  const io = { getState: () => a.state, applyRemote: () => {}, loadMeta: () => meta, saveMeta: (m) => { meta = m } }
  await assert.rejects(syncOnce({ adapter: flaky, hatcheryId: 'h1', io }), /no signal/)
  assert.equal(s.rows.size, 0)
  fail = false
  const r = await syncOnce({ adapter: flaky, hatcheryId: 'h1', io })
  assert.equal(r.pushed, 2)
  assert.equal(s.rows.size, 2)
})

test('a big backlog is uploaded in batches', async () => {
  const s = server(); const many = Array.from({ length: 450 }, (_, i) => sample(`s${i}`, i))
  const a = phone(s, { samples: many })
  await a.sync()
  assert.equal(a.counter.pushes, 3) // 451 records in batches of 200
  assert.equal(s.rows.size, 451)
})

test('re-downloading the overlap window changes nothing', async () => {
  const s = server(); const a = phone(s, { samples: [sample('s1', 1700)] }); await a.sync()
  const before = JSON.stringify(a.state)
  const r = await a.sync()
  assert.equal(r.applied, 0)
  assert.equal(JSON.stringify(a.state), before)
})

test('new records from the cloud are placed newest first', () => {
  const state = { samples: [sample('old', 1, '2026-09-01T00:00:00Z')] }
  const next = applyPlan(state, { upserts: [{ collection: 'samples', id: 'new', data: sample('new', 2, '2026-09-20T00:00:00Z') }], deletes: [] })
  assert.deepEqual(next.samples.map((x) => x.id), ['new', 'old'])
})

test('collect gives every record and the shared settings only', () => {
  const m = collect({ settings: { hatchery: 'X', language: 'te', textSize: 'xl' }, samples: [sample('s1', 1)], batches: [{ id: 'b1' }] })
  assert.deepEqual([...m.keys()].sort(), ['batches:b1', 'samples:s1', 'settings:main'])
  assert.deepEqual(m.get('settings:main').data, { hatchery: 'X' })
})

test('a new phone never uploads blank settings over the hatchery settings', async () => {
  const s = server(); const a = phone(s); a.state = { ...a.state, settings: { ...a.state.settings, hatchery: 'Demo Hatchery', operator: 'K. Ramesh' } }
  await a.sync()
  const b = phone(s); await b.sync(); await a.sync()
  assert.equal(b.state.settings.hatchery, 'Demo Hatchery')
  assert.equal(a.state.settings.hatchery, 'Demo Hatchery', 'the original settings are still there')
  assert.equal(s.rows.get('settings:main').data.hatchery, 'Demo Hatchery')
})

test('if the cloud has no settings yet, this phone settings are uploaded', async () => {
  const s = server(); const a = phone(s); a.state = { ...a.state, settings: { ...a.state.settings, hatchery: 'My Hatchery' } }
  await a.sync()
  assert.equal(s.rows.get('settings:main').data.hatchery, 'My Hatchery')
})
