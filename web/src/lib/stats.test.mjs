// Run: node --test web/src/lib/stats.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { batchStats } from './stats.js'

const batch = { id: 'b', tankVolumeL: '2000', sampleVolumeMl: '250' }
const S = (id, count, trayId, batchId = 'b') => ({ id, count, trayId, batchId })

test('each photo is its own tray when there is no trayId', () => {
  const st = batchStats(batch, [S('1', 100), S('2', 200)])
  assert.equal(st.n, 2)
  assert.equal(st.mean, 150)
})

test('photos of the same tray are averaged into one tray', () => {
  const st = batchStats(batch, [S('1', 1700, 't1'), S('2', 1800, 't1'), S('3', 1900, 't1'), S('4', 1000)])
  assert.equal(st.n, 2)          // one tray of 3 shots, plus one single
  assert.equal(st.shots, 4)
  assert.equal(st.mean, (1800 + 1000) / 2)
})

test('other batches are ignored and an empty batch is safe', () => {
  assert.deepEqual(batchStats(batch, [S('1', 5, undefined, 'other')]), { n: 0, shots: 0 })
})

test('volumetric estimate uses the tray average', () => {
  const st = batchStats(batch, [S('1', 400, 't'), S('2', 420, 't')])
  assert.equal(st.estTotal, 410 * 8000)
})
