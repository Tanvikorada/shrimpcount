// Run: node --test web/src/lib/growth.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { fitLine, daysToTarget } from './growth.js'

test('fits a perfect line', () => {
  const l = fitLine([{ day: 0, w: 1 }, { day: 1, w: 2 }, { day: 2, w: 3 }])
  assert.ok(Math.abs(l.slope - 1) < 1e-9 && Math.abs(l.intercept - 1) < 1e-9)
})
test('needs 3 points', () => assert.equal(fitLine([{ day: 0, w: 1 }, { day: 1, w: 2 }]), null))
test('days to target', () => {
  const pts = [{ day: 0, w: 1 }, { day: 10, w: 2 }, { day: 20, w: 3 }] // 0.1 g/day
  assert.equal(daysToTarget(pts, 5), 20)
})
test('no growth gives null', () => assert.equal(daysToTarget([{ day: 0, w: 3 }, { day: 5, w: 3 }, { day: 9, w: 3 }], 5), null))
