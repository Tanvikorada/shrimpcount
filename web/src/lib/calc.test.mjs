// Run: node --test web/src/lib/calc.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { survivalRate, tankVolumeL, dailyFeed, fcr, volumetricTotal } from './calc.js'

test('survival rate', () => {
  assert.equal(survivalRate(100000, 75000), 75)
  assert.ok(Number.isNaN(survivalRate(0, 5)))
})

test('tank volume', () => {
  assert.equal(tankVolumeL('rect', 5, 2, 1), 10000)
  assert.ok(Math.abs(tankVolumeL('round', 2, 0, 1) - 3141.59) < 0.01)
})

test('daily feed', () => {
  const f = dailyFeed(100000, 80, 5, 4) // 100000 * 0.8 * 5 g = 400 kg biomass, 4% = 16 kg
  assert.equal(f.biomassKg, 400)
  assert.equal(f.feedKg, 16)
})

test('fcr and volumetric total', () => {
  assert.equal(fcr(150, 100), 1.5)
  assert.ok(Number.isNaN(fcr('', 5)))
  assert.equal(volumetricTotal(40, 5000, 100), 40 * 50000)
})
