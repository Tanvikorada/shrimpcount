import { PARAMS, outOfRange } from './water'
import { fmtDate } from './format'

const today = () => new Date().toLocaleDateString('en-CA')

/** Things that need the operator's eye: low stock, out-of-range water, overdue tasks. */
export function attention(store) {
  const out = []
  for (const i of store.inventory) {
    if (i.reorderAt !== '' && i.reorderAt != null && Number(i.qty) <= Number(i.reorderAt)) {
      out.push({ kind: 'stock', title: `${i.name} running low`, sub: `${i.qty} ${i.unit} left · alert at ${i.reorderAt} ${i.unit}`, to: '/inventory' })
    }
  }
  const latest = new Map()
  for (const w of store.water) if (!latest.has(w.tank || '')) latest.set(w.tank || '', w) // newest first
  for (const [tank, w] of latest) {
    for (const p of PARAMS) {
      if (outOfRange(store.settings, p.key, w[p.key])) {
        out.push({ kind: 'water', title: `${tank ? `Tank ${tank}` : 'Tank'} ${p.label} is ${w[p.key]}`, sub: 'Outside your set range · latest reading', to: '/water' })
      }
    }
  }
  const t = today()
  for (const k of store.tasks) {
    if (!k.done && k.due && k.due < t) out.push({ kind: 'task', title: `${k.title} is overdue`, sub: `${k.assignee ? `${k.assignee} · ` : ''}due ${fmtDate(k.due)}`, to: '/tasks' })
  }
  return out
}
