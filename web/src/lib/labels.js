// Corrected marks: what the counter found, and what the person changed. This is the ground truth that lets the counter be
// measured properly (missed larvae, wrong marks) instead of only comparing totals. Pure code, so it can be tested with node.

/**
 * dets: [{ cx, cy, r, added, removed, est }] in the counted photo's pixels; inTray: [bool] per det.
 * scale: stored photo width / counted photo width (the stored copy may be smaller).
 * Every mark keeps a status: kept (counted, the counter's own), added (the person marked a miss), removed (the person
 * unmarked a wrong one), outside (the counter marked it but it was outside the water outline, so it was not counted).
 */
export function buildLabel({ id, dets, inTray, outline, width, height, scale = 1, meta }) {
  const s = (v) => Math.round(v * scale * 10) / 10
  const marks = dets.map((d, i) => ({
    x: s(d.cx), y: s(d.cy), r: s(d.r),
    src: d.added ? 'person' : 'counter',
    status: d.added ? 'added' : !inTray[i] ? 'outside' : d.removed ? 'removed' : 'kept',
    ...(d.est ? { est: true } : {}),
  }))
  return {
    version: 1,
    id,
    photo: `photos/${id}.jpg`,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    outline: (outline || []).map(([x, y]) => [s(x), s(y)]),
    marks,
    ...meta,
  }
}

/** The corrected truth for a label: what the person accepted (kept + added). Estimated hidden marks are reported apart. */
export function truthOf(label) {
  const ok = label.marks.filter((m) => m.status === 'kept' || m.status === 'added')
  return { truth: ok.length, estimated: ok.filter((m) => m.est).length, missed: label.marks.filter((m) => m.status === 'added').length, wrong: label.marks.filter((m) => m.status === 'removed').length }
}

// ---- a minimal .zip writer (files stored, not compressed: photos are JPEG already), so one file carries everything ----
const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** files: [{ name, data: Uint8Array }] -> Uint8Array holding a valid zip. Names must be plain ASCII. */
export function makeZip(files, when = new Date()) {
  const enc = new TextEncoder()
  const dosTime = ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xffff
  const dosDate = (((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xffff
  const parts = [], central = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true)
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true)
    local.setUint32(18, size, true); local.setUint32(22, size, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true)
    parts.push(new Uint8Array(local.buffer), name, f.data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true)
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true)
    c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    central.push(new Uint8Array(c.buffer), name)
    offset += 30 + name.length + size
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of all) { out.set(p, at); at += p.length }
  return out
}
