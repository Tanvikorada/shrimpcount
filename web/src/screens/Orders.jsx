import { useState } from 'react'
import { Card, Empty, Button, Badge, Field, PageHeader } from '../components/ui'
import { fmt, fmtDate } from '../lib/format'
import { money, orderBalance } from '../lib/money'
import { Plus } from '../components/icons'
import { t } from '../lib/i18n'


export function OrderList({ store, go }) {
  const { orders, batches } = store
  return (
    <>
      <PageHeader title={t('o_title')} sub={t('o_sub')}
        right={<Button onClick={() => go('/orders/new')}><Plus width={18} />{t('o_new')}</Button>} />
      {orders.length === 0 ? (
        <Empty title={t('o_none')} body={t('o_none_body')}
          action={<Button onClick={() => go('/orders/new')}>{t('o_first')}</Button>} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between px-1 text-[0.8125rem] text-slate-500">
            <span><b className="text-[0.9375rem] text-slate-900">{fmt(orders.filter((o) => o.status === 'pending').reduce((a, o) => a + Number(o.plQuantity || 0), 0))} PL</b> {t('o_to_deliver')}</span>
            <span><b className="text-[0.9375rem] text-slate-900">{money(orders.reduce((a, o) => a + (Number.isFinite(orderBalance(o)) ? Math.max(0, orderBalance(o)) : 0), 0))}</b> {t('o_outstanding')}</span>
          </div>
          {orders.map((o) => {
            const b = batches.find((x) => x.id === o.batchId)
            const bal = orderBalance(o)
            return (
              <Card key={o.id}>
                <button className="flex min-h-[4.75rem] w-full items-center justify-between gap-3 p-4 text-left" onClick={() => go(`/order/${o.id}`)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{o.customer}</span>
                      <Badge tone={o.status === 'delivered' ? 'teal' : 'amber'}>{o.status === 'delivered' ? t('o_delivered') : t('o_pending')}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">{b ? t('o_batch_n', { c: b.code }) : t('o_no_batch')}{o.date ? ` · ${fmtDate(o.date)}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{fmt(o.plQuantity)}</div>
                    <div className="text-xs text-slate-500">PL{Number.isFinite(bal) ? (bal > 0 ? ` · ${t('o_due', { m: money(bal) })}` : ` · ${t('o_paid')}`) : ''}</div>
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

export function NewOrder({ store, go }) {
  const [f, setF] = useState({ customer: '', phone: '', plQuantity: '', pricePer1000: '', batchId: store.batches.find((b) => b.status === 'active')?.id || '', date: new Date().toLocaleDateString('en-CA'), notes: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    const o = store.addOrder({ ...f, customer: f.customer.trim() })
    go(`/order/${o.id}`)
  }
  return (
    <>
      <PageHeader title={t('o_f_title')} onBack={() => go('/orders')} />
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('o_customer')} required value={f.customer} onChange={set('customer')} />
        <Field label={t('o_phone')} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('o_qty')} required type="number" inputMode="numeric" value={f.plQuantity} onChange={set('plQuantity')} />
          <Field label={t('o_price')} type="number" inputMode="decimal" value={f.pricePer1000} onChange={set('pricePer1000')} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('o_batch')}</span>
          <select value={f.batchId} onChange={set('batchId')} className="mt-1 min-h-12 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 text-base">
            <option value="">{t('o_no_batch')}</option>
            {store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}{b.plStage ? ` (${b.plStage})` : ''}</option>)}
          </select>
        </label>
        <Field label={t('o_date')} type="date" value={f.date} onChange={set('date')} />
        <Field label={t('o_notes')} value={f.notes} onChange={set('notes')} />
        <Button className="w-full">{t('o_create')}</Button>
      </form>
    </>
  )
}
