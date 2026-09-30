// Run: node --test web/src/lib/tray.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { inside, toPixels, toNorm } from './tray.js'

const octagon = [[0.13, 0.09], [0.88, 0.09], [1, 0.2], [1, 0.8], [0.87, 0.92], [0.14, 0.92], [0, 0.8], [0, 0.2]]

test('points in the water are inside, the wall and cut corners are outside', () => {
  const p = toPixels(octagon, 1000, 1000)
  assert.equal(inside(p, 500, 500), true)
  assert.equal(inside(p, 500, 50), false)   // wall above the tray
  assert.equal(inside(p, 20, 60), false)    // cut-off corner
  assert.equal(inside(p, 990, 960), false)  // opposite corner
  assert.equal(inside(p, 60, 500), true)    // larva near the side wall is kept
})

test('pixels and fractions round-trip', () => {
  const back = toNorm(toPixels(octagon, 1280, 960), 1280, 960)
  back.forEach(([x, y], i) => { assert.ok(Math.abs(x - octagon[i][0]) < 1e-9 && Math.abs(y - octagon[i][1]) < 1e-9) })
})

import { emptyTrays, withTray, withoutTray, withActive, activeTray } from './tray.js'

test('several tray profiles: add, switch, update, delete', () => {
  let t = emptyTrays()
  assert.equal(activeTray(t), null)
  t = withTray(t, { id: 'a', name: 'Tray A', norm: octagon })
  t = withTray(t, { id: 'b', name: 'Tray B', norm: octagon })
  assert.equal(t.active, 'b')
  assert.equal(t.list.length, 2)
  t = withActive(t, 'a')
  assert.equal(activeTray(t).name, 'Tray A')
  t = withTray(t, { id: 'a', name: 'Tray A', norm: [[0, 0], [1, 0], [1, 1]] })
  assert.equal(t.list.length, 2)
  assert.equal(activeTray(t).norm.length, 3)
  t = withoutTray(t, 'a')
  assert.equal(t.active, null)
  assert.equal(t.list.length, 1)
  assert.equal(withActive(t, 'missing').active, null)
})
