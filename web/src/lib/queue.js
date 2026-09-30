// Tiny IndexedDB queue for photos that could not be sent to the counting service (offline).
const DB = 'shrimpcount-queue'
const STORE = 'images'

const open = () => new Promise((resolve, reject) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})

const tx = async (mode, fn) => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(out.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

export const queuePut = (id, blob) => tx('readwrite', (s) => s.put(blob, id)).catch(() => {})
export const queueRemove = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})
export async function queueAll() {
  try {
    const keys = await tx('readonly', (s) => s.getAllKeys())
    const vals = await tx('readonly', (s) => s.getAll())
    return keys.map((id, i) => ({ id, blob: vals[i] }))
  } catch { return [] }
}
