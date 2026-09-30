import { PARAMS, outOfRange } from './water'
import { fmtDate } from './format'
import { t } from './i18n'

const today = () => new Date().toLocaleDateString('en-CA')

/** Things that need the operator's eye: low stock, out-of-range water, overdue tasks. */
export function attention(store) {
  const out = []
  for (const i of store.inventory) {
    if (i.reorderAt !== '' && i.reorderAt != null && Number(i.qty) <= Number(i.reorderAt)) {
      out.push({ kind: 'stock', title: t('att_stock_low', { name: i.name }), sub: t('att_stock_sub', { qty: i.qty, unit: i.unit, reorder: i.reorderAt }), to: '/inventory' })
    }
  }
  const latest = new Map()
  for (const w of store.water) if (!latest.has(w.tank || '')) latest.set(w.tank || '', w) // newest first
  for (const [tank, w] of latest) {
    for (const p of PARAMS) {
      if (outOfRange(store.settings, p.key, w[p.key])) {
        out.push({ kind: 'water', title: t('att_water_title', { tank: tank ? t('att_water_tank', { tank }) : t('tank_word'), param: t(p.labelKey), v: w[p.key] }), sub: t('att_water_sub'), to: '/water' })
      }
    }
  }
  const now = today()
  for (const k of store.tasks) {
    if (!k.done && k.due && k.due < now) out.push({ kind: 'task', title: t('att_task_title', { title: k.title }), sub: `${k.assignee ? `${k.assignee} · ` : ''}${t('tsk_due', { date: fmtDate(k.due) })}`, to: '/tasks' })
  }
  return out
}
