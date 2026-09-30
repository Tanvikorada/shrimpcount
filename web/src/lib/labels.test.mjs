// Run: node --test web/src/lib/labels.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildLabel, truthOf, makeZip, crc32 } from './labels.js'

const dets = [
  { cx: 100, cy: 100, r: 6, added: false, removed: false },
  { cx: 200, cy: 100, r: 6, added: false, removed: true },
  { cx: 300, cy: 100, r: 6, added: true, removed: false },
  { cx: 900, cy: 900, r: 6, added: false, removed: false },
  { cx: 400, cy: 100, r: 6, added: false, removed: false, est: true },
]

test('marks carry a status and the truth is kept + added', () => {
  const l = buildLabel({ id: 'x', dets, inTray: [true, true, true, false, true], outline: [[0, 0], [10, 0], [10, 10]], width: 1000, height: 800 })
  assert.deepEqual(l.marks.map((m) => m.status), ['kept', 'removed', 'added', 'outside', 'kept'])
  assert.deepEqual(truthOf(l), { truth: 3, estimated: 1, missed: 1, wrong: 1 })
})

test('coordinates follow the stored photo size', () => {
  const l = buildLabel({ id: 'x', dets, inTray: dets.map(() => true), outline: [], width: 4000, height: 3000, scale: 0.4 })
  assert.equal(l.width, 1600); assert.equal(l.height, 1200); assert.equal(l.marks[0].x, 40)
})

test('crc32 matches the known check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})

test('the zip is readable by a real unzip tool', () => {
  const zip = makeZip([{ name: 'labels/a.json', data: new TextEncoder().encode('{"a":1}') }, { name: 'photos/a.jpg', data: new Uint8Array([255, 216, 255, 0, 1, 2]) }])
  const f = path.join(os.tmpdir(), `sc-${Date.now()}.zip`)
  fs.writeFileSync(f, zip)
  const py = `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(sorted(z.namelist()), z.read('labels/a.json'))`
  const out = execFileSync('python', ['-c', py, f]).toString()
  assert.match(out, /labels\/a\.json/); assert.match(out, /\{"a":1\}/)
  fs.unlinkSync(f)
})
