// Writes docs/translation-review.csv: every phrase the app and the website show, in English and the three translations,
// with empty columns for a native speaker to correct. The Telugu, Hindi and Tamil wording is a first draft and has never
// been read by a native speaker who works in a hatchery (see the note at the top of web/src/lib/i18n.js).
//
// Run from the repo root:  node tools/export_translations.mjs
// Open the CSV in Google Sheets or Excel (UTF-8). The reviewer fills "te fix", "hi fix", "ta fix" only where the draft is
// wrong or unnatural, and may add a note. Then someone copies the fixes back into web/src/lib/i18n.js (app) and
// landing/i18n.json (website); the "where" column says which file each row lives in.
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const { DICT } = await import(pathToFileURL(resolve('web/src/lib/i18n.js')).href)
const site = JSON.parse(readFileSync('landing/i18n.json', 'utf8')).t

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' / ')}"`
const rows = [['where', 'key', 'English', 'Telugu (draft)', 'Hindi (draft)', 'Tamil (draft)', 'te fix', 'hi fix', 'ta fix', 'reviewer note']]

for (const key of Object.keys(DICT.en)) {
  rows.push(['app', key, DICT.en[key], DICT.te?.[key], DICT.hi?.[key], DICT.ta?.[key], '', '', '', ''])
}
// phrases that only the website has (the website shares many keys with the app and shows the app's wording for them)
for (const key of Object.keys(site.en)) {
  if (key in DICT.en) continue
  rows.push(['website', key, site.en[key], site.te?.[key], site.hi?.[key], site.ta?.[key], '', '', '', ''])
}

const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
writeFileSync('docs/translation-review.csv', csv)
console.log(`wrote docs/translation-review.csv: ${rows.length - 1} phrases (${Object.keys(DICT.en).length} app, ${rows.length - 1 - Object.keys(DICT.en).length} website-only)`)
