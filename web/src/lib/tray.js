// The tray outline: the water area inside which larvae are counted. Marks on the tray wall, corner tags and labels fall
// outside it and are not counted. A hatchery can keep several outlines (one per tray type or camera setup) and pick one
// per count. The functions here are pure so they can be tested; only read/write touch storage.

const KEY = 'shrimpcount.trays'
const OLD_KEY = 'shrimpcount.tray' // the first version stored a single outline

/** Ray casting. poly is [[x, y], ...]. */
export function inside(poly, x, y) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export const toPixels = (norm, w, h) => norm.map(([x, y]) => [x * w, y * h])
export const toNorm = (px, w, h) => px.map(([x, y]) => [x / w, y / h])

// ---- profiles: { active: id | null, list: [{ id, name, norm }] } ----
export const emptyTrays = () => ({ active: null, list: [] })
export const activeTray = (t) => t.list.find((p) => p.id === t.active) || null

export function withTray(t, profile) {
  const has = t.list.some((p) => p.id === profile.id)
  return { active: profile.id, list: has ? t.list.map((p) => (p.id === profile.id ? profile : p)) : [...t.list, profile] }
}
export function withoutTray(t, id) {
  const list = t.list.filter((p) => p.id !== id)
  return { active: t.active === id ? null : t.active, list }
}
export const withActive = (t, id) => ({ ...t, active: t.list.some((p) => p.id === id) ? id : null })

const valid = (norm) => Array.isArray(norm) && norm.length >= 3 && norm.every((q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite))

export function readTrays() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && Array.isArray(v.list)) return { active: v.active ?? null, list: v.list.filter((p) => p && p.id && valid(p.norm)) }
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (valid(old)) return { active: 'my-tray', list: [{ id: 'my-tray', name: 'My tray', norm: old }] }
  } catch { /* fall through */ }
  return emptyTrays()
}

export function writeTrays(t) {
  try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* storage may be blocked */ }
}
