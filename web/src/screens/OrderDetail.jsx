import { useState } from 'react'
import { Card, Empty, Button, Badge, PageHeader } from '../components/ui'
import { DocFooter, DocHeader, DocRow, SignBlock, useEvidence } from '../components/Doc'
import { batchStats } from '../lib/store'
import { fmt, fmtDate, shareText, steadiness, words , docDate, docSteadiness } from '../lib/format'
import { money, orderTotal, orderPaid, rupeesInWords } from '../lib/money'
import { Share } from '../components/icons'
import { t } from '../lib/i18n'

const dateCode = (iso) => new Date(iso).toISOString().slice(0, 10).replace(/-/g, '')
const field = 'mt-1 min-h-14 w-full rounded-2xl bg-surface px-4 text-base ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-teal-600'

export default function OrderDetail({ id, store, go }) {
  const o = store.orders.find((x) => x.id === id)
  const [doc, setDoc] = useState('certificate')
  const [pay, setPay] = useState({ amount: '', method: 'Cash' })
  const batchId = o?.batchId
  const batchSamples = store.samples.filter((s) => s.batchId === batchId)
  const photos = useEvidence(batchSamples, 2) // marked photos of the two latest counts of the delivered batch
  if (!o) return <Empty title={t('od_nf')} body={t('od_nf_body')} action={<Button onClick={() => go('/orders')}>{t('back')}</Button>} />

  const b = store.batches.find((x) => x.id === o.batchId)
  const st = b ? batchStats(b, store.samples) : { n: 0 }
  const tests = b ? store.tests.filter((x) => x.batchId === b.id) : []
  const name = store.settings.hatchery || 'Hatchery'
  const operator = store.settings.operator
  const total = orderTotal(o)
  const paid = orderPaid(o)
  const balance = Number.isFinite(total) ? total - paid : NaN
  const ref = o.id.slice(0, 6).toUpperCase()
  const issued = new Date(o.date || o.createdAt || Date.now())
  const certNo = `CERT-${dateCode(issued)}-${ref}`
  const invNo = `INV-${dateCode(issued)}-${ref}`
  const settled = Number.isFinite(balance) && balance <= 0
  const steady = st.n > 1 ? docSteadiness(st.cv) : null
  const message = doc === 'invoice'
    ? `${name}\nInvoice ${invNo} for ${o.customer}\n${fmt(o.plQuantity)} PL${o.pricePer1000 ? ` at ${money(Number(o.pricePer1000))} per 1,000` : ''}\nTotal: ${money(total)}\nPaid: ${money(paid)}\nBalance due: ${money(balance)}`
    : `${name}\nPL delivery certificate ${certNo}\nCustomer: ${o.customer}\nQuantity: ${fmt(o.plQuantity)} PL${b ? `\nBatch ${b.code}${b.plStage ? ` (${b.plStage})` : ''}` : ''}${st.n ? `\nSample average: ${fmt(st.mean)} PL over ${st.n} count${st.n === 1 ? '' : 's'}` : ''}${o.date ? `\nDate: ${fmtDate(o.date)}` : ''}`

  const addPayment = (e) => {
    e.preventDefault()
    const amount = Number(pay.amount)
    if (!(amount > 0)) return
    store.updateOrder(id, { payments: [...(o.payments || []), { id: crypto.randomUUID(), amount, method: pay.method, date: new Date().toISOString() }] })
    setPay({ amount: '', method: 'Cash' })
  }
  const delPayment = (pid) => store.updateOrder(id, { payments: (o.payments || []).filter((p) => p.id !== pid) })

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={o.customer} onBack={() => go('/orders')}
          right={<Badge tone={o.status === 'delivered' ? 'teal' : 'amber'}>{o.status === 'delivered' ? t('o_delivered') : t('o_pending')}</Badge>} />

        <div className="mb-3 flex gap-1.5 rounded-2xl bg-slate-200/70 p-1.5" role="group" aria-label="Document">
          {[['certificate', t('od_cert')], ['invoice', t('od_inv')]].map(([k, l]) => (
            <button key={k} aria-pressed={doc === k} onClick={() => setDoc(k)}
              className={`min-h-12 flex-1 rounded-xl text-[0.9375rem] font-semibold ${doc === k ? 'bg-surface text-teal-700' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button onClick={() => window.print()}>{t('od_print')}</Button>
          <Button variant="ghost" onClick={() => shareText(message)}><Share width={18} />{t('od_share')}</Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => store.updateOrder(id, { status: o.status === 'pending' ? 'delivered' : 'pending' })}>
            {o.status === 'pending' ? t('od_mark_del') : t('od_mark_pend')}</Button>
          <Button variant="danger" onClick={() => confirm(t('od_del_confirm')) && (store.deleteOrder(id), go('/orders'))}>{t('delete')}</Button>
        </div>

        <Card className="mb-5 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[1.125rem] font-bold text-slate-900">{t('od_pay')}</h3>
            {Number.isFinite(balance) && <Badge tone={settled ? 'teal' : 'amber'}>{settled ? t('od_paid_full') : t('o_due', { m: money(balance) })}</Badge>}
          </div>
          {Number.isFinite(total) && <div className="mt-1 text-[0.8125rem] text-slate-500">{t('od_total', { a: money(total), b: money(paid) })}</div>}
          {(o.payments || []).length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100">
              {o.payments.map((p) => (
                <li key={p.id} className="flex min-h-12 items-center justify-between py-2 text-sm">
                  <span><b>{money(p.amount)}</b> <span className="text-slate-500">· {p.method} · {fmtDate(p.date)}</span></span>
                  <button className="min-h-11 min-w-11 text-xs font-semibold text-red-700" aria-label={t('od_del_pay')} onClick={() => confirm(t('od_del_pay_confirm')) && delPayment(p.id)}>{t('delete')}</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addPayment} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-28 flex-1"><span className="text-xs font-semibold text-slate-600">{t('od_amount')}</span>
              <input type="number" inputMode="decimal" step="any" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={field} /></label>
            <label className="w-32"><span className="text-xs font-semibold text-slate-600">{t('od_method')}</span>
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className={field}>
                {[['Cash', t('od_cash')], ['UPI', t('od_upi')], ['Bank', t('od_bank')], ['Cheque', t('od_cheque')]].map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></label>
            <Button>{t('od_add')}</Button>
          </form>
        </Card>
      </div>

      <article className="rounded-3xl bg-surface p-6 ring-1 ring-white/[0.09] print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {doc === 'certificate' ? (
          <>
            <DocHeader label="PL delivery certificate" name={name} number={certNo} date={issued} />

            <section className="mt-5 rounded-2xl bg-teal-50 p-5">
              <p className="text-[0.9375rem] leading-relaxed text-teal-950">
                This is to certify that <b>{name}</b> delivered
              </p>
              <div className="my-1 text-[2.25rem] font-bold leading-none tabular-nums tracking-tight text-teal-900">{fmt(o.plQuantity)} <span className="text-[1.25rem] font-semibold">PL</span></div>
              {words(Number(o.plQuantity)) && <div className="text-[1.0625rem] font-semibold text-teal-800">≈ {words(Number(o.plQuantity))}</div>}
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-teal-950">
                {b ? <>(<b>{[b.species, b.plStage].filter(Boolean).join(' ') || 'postlarvae'}</b>, batch <b className="whitespace-nowrap">{b.code}</b>) </> : null}to <b>{o.customer}</b>{o.date ? <> on <b>{fmtDate(o.date)}</b></> : null}.
              </p>
            </section>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-slate-200 py-4 text-sm">
              <DocRow k="Customer">{o.customer}</DocRow>
              <DocRow k="Phone">{o.phone || '–'}</DocRow>
              <DocRow k="Delivery date">{o.date ? docDate(o.date) : '–'}</DocRow>
              <DocRow k="Order ref">{ref}</DocRow>
            </dl>

            {b ? (
              <section className="border-b border-slate-200 py-4 text-sm print:break-inside-avoid">
                <h3 className="mb-3 text-[0.9375rem] font-bold text-slate-900">Batch counts</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <DocRow k="Batch">{b.code}</DocRow>
                  <DocRow k="Tank">{b.tank || '–'}</DocRow>
                  <DocRow k="Counts taken">{st.n}</DocRow>
                  <DocRow k="Average per sample">{st.n ? fmt(st.mean) : '–'}</DocRow>
                </dl>
                {steady && <p className="mt-3 text-[0.8125rem] text-slate-500">Between samples: <b className="text-slate-700">{steady.text}</b> ({st.cv.toFixed(1)}% spread).</p>}
                {photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {photos.map((p) => <img key={p.id} src={p.url} alt={`Counted tray, ${fmt(p.count)}`} className="w-full rounded-xl print:break-inside-avoid" />)}
                  </div>
                )}
                {photos.length > 0 && <p className="mt-2 text-[0.75rem] text-slate-500">Counted samples from this batch. Each ring is one larva counted.</p>}
                {tests.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disease tests</div>
                    <ul className="mt-1 space-y-0.5">{tests.map((t) => <li key={t.id}>{t.test}: <b>{t.result}</b>{t.ref ? ` (ref ${t.ref})` : ''}{t.lab ? `, ${t.lab}` : ''}</li>)}</ul>
                  </div>
                )}
              </section>
            ) : <p className="border-b border-slate-200 py-4 text-sm text-slate-500">No batch linked to this order.</p>}

            {o.pricePer1000 ? (
              <div className="flex items-baseline justify-between border-b border-slate-200 py-4 text-sm">
                <span className="text-slate-500">Amount ({money(Number(o.pricePer1000))} per 1,000)</span>
                <span className="text-[1.125rem] font-bold tabular-nums text-slate-900">{money(total)}</span>
              </div>
            ) : null}
            {o.notes && <p className="border-b border-slate-200 py-3 text-sm"><span className="text-slate-500">Notes:</span> {o.notes}</p>}

            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-[0.75rem] leading-relaxed text-slate-500 print:break-inside-avoid">
              The delivered quantity is as stated by the hatchery. Counts shown are per sample from the batch and are not a count of the full delivery.
              Test results are as entered by the hatchery. This certificate records the delivery; it is not a laboratory report.
            </p>
            <SignBlock items={[['For the hatchery', operator], ['Received by (customer) / date']]} />
            <DocFooter number={certNo} />
          </>
        ) : (
          <>
            <DocHeader label="Invoice" name={name} number={invNo} date={issued} />

            <div className="grid grid-cols-2 gap-6 border-b border-slate-200 py-4 text-sm">
              <div><div className="text-xs text-slate-500">From</div><div className="font-semibold text-slate-900">{name}</div>{operator && <div className="text-slate-500">{operator}</div>}</div>
              <div><div className="text-xs text-slate-500">Billed to</div><div className="font-semibold text-slate-900">{o.customer}</div>{o.phone && <div className="text-slate-500">{o.phone}</div>}</div>
              <DocRow k="Invoice date">{docDate(issued.toISOString())}</DocRow>
              <DocRow k="Order ref">{ref}</DocRow>
            </div>

            <section className="mt-4 border-b border-slate-200 pb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Item</div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[1rem] font-semibold text-slate-900">Postlarvae</div>
                  {b && <div className="text-[0.8125rem] text-slate-500">Batch <span className="whitespace-nowrap">{b.code}</span>{[b.species, b.plStage].filter(Boolean).length ? ` · ${[b.species, b.plStage].filter(Boolean).join(' ')}` : ''}</div>}
                  <div className="mt-1 text-[0.875rem] text-slate-600 tabular-nums">{fmt(o.plQuantity)} PL{o.pricePer1000 ? ` × ${money(Number(o.pricePer1000))} per 1,000` : ''}</div>
                </div>
                <div className="shrink-0 text-[1.125rem] font-bold tabular-nums text-slate-900">{money(total)}</div>
              </div>
            </section>

            <div className="mt-4">
              {Number.isFinite(total) && (
                <div className="mb-3 flex justify-end">
                  <span className={`-rotate-3 rounded-xl border-[3px] px-3 py-0.5 text-[0.9375rem] font-extrabold tracking-[0.2em] ${settled ? 'border-good-500 text-good-500' : 'border-amber-500 text-amber-600'}`}>{settled ? 'PAID' : 'BALANCE DUE'}</span>
                </div>
              )}
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-semibold tabular-nums">{money(total)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Received</dt><dd className="tabular-nums">{money(paid)}</dd></div>
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2"><dt className="text-base font-bold">Balance due</dt><dd className="text-[1.5rem] font-bold tabular-nums tracking-tight">{money(balance)}</dd></div>
              </dl>
            </div>

            {rupeesInWords(total) && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-[0.8125rem] text-slate-600"><span className="text-slate-500">Amount in words: </span><b className="text-slate-800">{rupeesInWords(total)}</b></p>}

            {(o.payments || []).length > 0 && (
              <section className="mt-5 print:break-inside-avoid">
                <h3 className="mb-2 text-[0.9375rem] font-bold text-slate-900">Payments received</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100"><td className="py-2 text-slate-500">{docDate(p.date)}</td><td>{p.method}</td><td className="text-right font-semibold tabular-nums">{money(p.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <p className="mt-5 text-[0.75rem] leading-relaxed text-slate-500">Amounts are as agreed with the customer and exclude any applicable taxes. Quantity is as stated by the hatchery.</p>
            <SignBlock items={[['Authorised signatory', operator]]} />
            <DocFooter number={invNo} />
          </>
        )}
      </article>
    </>
  )
}
