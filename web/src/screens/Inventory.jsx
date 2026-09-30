import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmt } from '../lib/format'
import { t } from '../lib/i18n'

const low = (i) => i.reorderAt !== '' && i.reorderAt != null && Number(i.qty) <= Number(i.reorderAt)

export default function Inventory({ store, go }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', unit: 'kg', qty: '', reorderAt: '' })
  const [amt, setAmt] = useState({})
  const items = store.inventory
  const lowCount = items.filter(low).length

  const submit = (e) => {
    e.preventDefault()
    store.addItem('inventory', { ...f, name: f.name.trim(), qty: Number(f.qty) })
    setF({ name: '', unit: 'kg', qty: '', reorderAt: '' }); setOpen(false)
  }
  const adjust = (i, sign) => {
    const n = Number(amt[i.id])
    if (!(n > 0)) return
    store.patchItem('inventory', i.id, { qty: Math.max(0, Number(i.qty) + sign * n) })
    setAmt({ ...amt, [i.id]: '' })
  }

  return (
    <>
      <PageHeader title={t('inv_title')} sub={lowCount ? t('inv_sub_low', { n: lowCount }) : t('inv_sub_default')} onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? t('cancel') : t('inv_add')}</Button>} />

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <Field label={t('inv_item_label')} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('inv_item_ph')} />
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('inv_unit_label')} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            <Field label={t('inv_stock_label')} required type="number" step="any" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            <Field label={t('inv_alert_label')} type="number" step="any" inputMode="decimal" value={f.reorderAt} onChange={(e) => setF({ ...f, reorderAt: e.target.value })} />
          </div>
          <Button className="w-full">{t('inv_save_item')}</Button>
        </form>
      )}

      {items.length === 0 ? (
        <Empty title={t('inv_empty_title')} body={t('inv_empty_body')} />
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold">{i.name}{low(i) && <Badge tone="amber">{t('inv_low_badge')}</Badge>}</div>
                  <div className="text-xs text-slate-500">{i.reorderAt !== '' && i.reorderAt != null ? t('inv_alert_at', { n: fmt(i.reorderAt), unit: i.unit }) : t('inv_no_alert')}</div>
                </div>
                <div className="text-right"><div className="text-2xl font-semibold tabular-nums">{fmt(i.qty)}</div><div className="text-xs text-slate-500">{i.unit}</div></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input aria-label={t('inv_amount_aria', { name: i.name })} type="number" step="any" inputMode="decimal" value={amt[i.id] ?? ''} onChange={(e) => setAmt({ ...amt, [i.id]: e.target.value })}
                  placeholder={t('inv_amount_ph')} className="w-24 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-2.5 py-1.5 text-sm" />
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => adjust(i, +1)}>{t('inv_received')}</Button>
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => adjust(i, -1)}>{t('inv_used')}</Button>
                <button className="ml-auto min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label={t('inv_delete_aria', { name: i.name })} onClick={() => confirm(t('inv_delete_confirm', { name: i.name })) && store.removeItem('inventory', i.id)}>{t('delete')}</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
