// The counted photo with its marks and a caption bar, kept on the phone so a report can show a customer exactly what was
// counted. Stored in IndexedDB (room for many photos); the small thumbnail in the main store stays as before.

const DB = 'shrimpcount-evidence'
const STORE = 'photos'

const open = () => new Promise((resolve, reject) => {
  const r = indexedDB.open(DB, 2)
  r.onupgradeneeded = () => { for (const n of [STORE, 'labels', 'originals']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n) }
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})

const tx = async (mode, fn, store = STORE) => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const out = fn(t.objectStore(store))
    t.oncomplete = () => { db.close(); resolve(out.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

export const evidencePut = (id, blob) => tx('readwrite', (s) => s.put(blob, id)).catch(() => {})
export const evidenceRemove = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})
// Corrected marks (a small JSON label) and the plain photo they belong to, kept on this phone for the accuracy export.
export const labelPut = (id, label, photo) => Promise.all([tx('readwrite', (s) => s.put(label, id), 'labels'), tx('readwrite', (s) => s.put(photo, id), 'originals')]).catch(() => {})
export const labelRemove = (id) => Promise.all([tx('readwrite', (s) => s.delete(id), 'labels'), tx('readwrite', (s) => s.delete(id), 'originals')]).catch(() => {})
export const labelIds = () => tx('readonly', (s) => s.getAllKeys(), 'labels').catch(() => [])
export const labelGet = (id) => Promise.all([tx('readonly', (s) => s.get(id), 'labels'), tx('readonly', (s) => s.get(id), 'originals')]).then(([label, photo]) => ({ label, photo })).catch(() => ({}))

/** The photo as a JPEG no wider than maxW (phone photos are large). Returns { blob, scale } or null. */
export function shrinkPhoto(url, maxW = 1600) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth)
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob((blob) => resolve(blob ? { blob, scale } : null), 'image/jpeg', 0.9)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export const evidenceKeys = () => tx('readonly', (s) => s.getAllKeys()).catch(() => [])

// If a photo is not on this phone (a count made on another phone), the cloud module can fetch it. It is kept here afterwards.
let fallback = null
export const setEvidenceFallback = (fn) => { fallback = fn }
export async function evidenceGet(id) {
  const local = await tx('readonly', (s) => s.get(id)).catch(() => undefined)
  if (local || !fallback) return local
  try {
    const blob = await fallback(id)
    if (blob) { await evidencePut(id, blob); return blob }
  } catch { /* offline or not there */ }
  return undefined
}

/**
 * Draw the photo, the counted marks, the tray outline and a caption bar.
 * marks: [{ cx, cy, r, added }] in the photo's own pixels; outline: [[x, y], ...] in the same pixels.
 */
export function renderEvidence({ url, width, height, marks, outline, count, title, subtitle, hatchery }) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const W = Math.min(1400, img.naturalWidth)
      const k = W / width
      const bar = Math.round(W * 0.075)
      const c = document.createElement('canvas')
      c.width = W
      c.height = Math.round((img.naturalHeight / img.naturalWidth) * W) + bar
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, W, c.height - bar)

      if (outline?.length > 2) {
        g.save()
        g.setLineDash([W * 0.011, W * 0.006]); g.lineWidth = Math.max(2, W / 450); g.strokeStyle = 'rgba(255,255,255,0.85)'
        g.beginPath(); outline.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); g.stroke()
        g.restore()
      }
      g.lineWidth = Math.max(1.5, W / 700)
      for (const m of marks) {
        g.strokeStyle = m.added ? '#e0a100' : '#e4572e'
        g.beginPath(); g.arc(m.cx * k, m.cy * k, Math.max(4, m.r * k), 0, Math.PI * 2); g.stroke()
      }

      // caption bar
      const y0 = c.height - bar
      g.fillStyle = '#0e151c'; g.fillRect(0, y0, W, bar)
      g.fillStyle = '#ffffff'; g.textBaseline = 'middle'
      g.font = `700 ${Math.round(bar * 0.5)}px -apple-system, "Segoe UI", Roboto, sans-serif`
      g.fillText(`${Number(count).toLocaleString('en-IN')} counted`, W * 0.025, y0 + bar / 2)
      g.textAlign = 'right'
      g.font = `600 ${Math.round(bar * 0.28)}px -apple-system, "Segoe UI", Roboto, sans-serif`
      g.fillText(title, W * 0.975, y0 + bar * 0.34)
      g.font = `400 ${Math.round(bar * 0.24)}px -apple-system, "Segoe UI", Roboto, sans-serif`
      g.fillStyle = 'rgba(255,255,255,0.78)'
      g.fillText([subtitle, hatchery].filter(Boolean).join('  ·  '), W * 0.975, y0 + bar * 0.7)
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
