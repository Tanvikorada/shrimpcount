// Run: node --test web/src/lib/counts.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCounts, countsCsv } from './counts.js'

const S = (id, iso, extra = {}) => ({ id, timestamp: iso, batchId: 'b1', count: 100, ...extra })
const rows = [
  S('a', '2026-09-01T09:00:00', { species: 'Vannamei' }),
  S('b', '2026-09-10T15:30:00', { species: 'Monodon' }),
  S('c', '2026-09-20T23:59:00', { species: 'Vannamei', batchId: 'b2' }),
]

test('date range is inclusive of the whole last day and sorted newest first', () => {
  const r = filterCounts(rows, { from: '2026-09-10', to: '2026-09-20' })
  assert.deepEqual(r.map((x) => x.id), ['c', 'b'])
})

test('species and batch filters combine', () => {
  assert.deepEqual(filterCounts(rows, { species: 'Vannamei' }).map((x) => x.id), ['c', 'a'])
  assert.deepEqual(filterCounts(rows, { species: 'Vannamei', batchId: 'b2' }).map((x) => x.id), ['c'])
  assert.equal(filterCounts(rows).length, 3)
})

test('csv has a header, quotes cells and defuses spreadsheet formulas', () => {
  const out = countsCsv([S('x', '2026-09-01T09:05:00', { notes: '=HYPERLINK("http://evil")', species: 'Vannamei' })], [{ id: 'b1', code: 'B-1', plStage: 'PL10' }])
  const [head, line] = out.split('\n')
  assert.ok(head.startsWith('date,time,batch,species'))
  assert.ok(line.includes('"B-1"') && line.includes('"PL10"'))
  assert.ok(line.includes(`"'=HYPERLINK`), 'formula must be prefixed so it is text')
})
