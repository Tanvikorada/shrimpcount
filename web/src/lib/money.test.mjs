// Run: node --test web/src/lib/money.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { rupeesInWords, orderTotal, orderBalance } from './money.js'

test('amounts are written in words with Indian grouping', () => {
  assert.equal(rupeesInWords(520000), 'Rupees Five Lakh Twenty Thousand Only')
  assert.equal(rupeesInWords(1234567), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only')
  assert.equal(rupeesInWords(100), 'Rupees One Hundred Only')
  assert.equal(rupeesInWords(25000000), 'Rupees Two Crore Fifty Lakh Only')
  assert.equal(rupeesInWords(19), 'Rupees Nineteen Only')
})

test('zero, negative and junk give no words', () => {
  assert.equal(rupeesInWords(0), '')
  assert.equal(rupeesInWords(-5), '')
  assert.equal(rupeesInWords('abc'), '')
})

test('order total and balance', () => {
  const o = { plQuantity: 500000, pricePer1000: 420, payments: [{ amount: 100000 }] }
  assert.equal(orderTotal(o), 210000)
  assert.equal(orderBalance(o), 110000)
})
