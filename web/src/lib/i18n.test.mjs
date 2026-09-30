// Run: node --test web/src/lib/i18n.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { DICT, LANGS, setLang, t, detectLang } from './i18n.js'

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every language has exactly the same phrases as English', () => {
  const en = Object.keys(DICT.en)
  for (const [code] of LANGS) {
    const keys = Object.keys(DICT[code])
    assert.deepEqual(en.filter((k) => !keys.includes(k)), [], `${code} is missing phrases`)
    assert.deepEqual(keys.filter((k) => !en.includes(k)), [], `${code} has phrases English does not`)
  }
})

test('every translation keeps the same {placeholders} as English', () => {
  for (const [code] of LANGS) {
    for (const k of Object.keys(DICT.en)) {
      assert.equal(placeholders(DICT[code][k]), placeholders(DICT.en[k]), `${code}.${k}`)
    }
  }
})

test('no translation is empty and none is just the English text (except brand names)', () => {
  for (const [code] of LANGS.filter(([c]) => c !== 'en')) {
    for (const [k, v] of Object.entries(DICT[code])) {
      assert.ok(v.trim().length > 0, `${code}.${k} is empty`)
      if (v === DICT.en[k]) assert.ok(/^[\d{}\s·%+−:.()A-Za-z/-]*$/.test(v) || v.length < 5, `${code}.${k} was not translated`)
    }
  }
})

test('t() fills placeholders and falls back to English for an unknown language or phrase', () => {
  setLang('te'); assert.match(t('saved_toast', { n: 1656 }), /1656/)
  setLang('xx'); assert.equal(t('back'), 'Back')
  setLang('hi'); assert.equal(t('not_a_key'), 'not_a_key')
  setLang('en')
})

test('detectLang picks a supported language and otherwise English', () => {
  assert.ok(LANGS.some(([c]) => c === detectLang()))
})
