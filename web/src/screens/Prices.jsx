import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader } from '../components/ui'
import { fmtDate } from '../lib/format'
import { money } from '../lib/money'

/** A manual log of shrimp prices you are quoted or hear about (₹ per kg by size count). No live feed. */
export default function Prices({ store, go }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ size: '', price: '', source: '', date: new Date().toLocaleDateString('en-CA') })
  const [sel, setSel] = useState('')
  const rows = store.prices.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  const sizes = [...new Set(rows.map((r) => r.size))]
  const size = sel || sizes[0]
  const series = rows.filter((r) => r.size === size).slice().reverse()

  const submit = (e) => {
    e.preventDefault()
    store.addItem('prices', { ...f, size: f.size.trim(), price: Number(f.price) })
    setOpen(false); setF({ ...f, price: '' })
  }

  const vals = series.map((r) => r.price)
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1
  const pts = vals.map((v, i) => `${vals.length === 1 ? 150 : (i / (vals.length - 1)) * 292 + 4},${56 - ((v - min) / span) * 46}`).join(' ')
  const last = series.at(-1), prev = series.at(-2)

  return (
    <>
      <PageHeader title="Shrimp prices" sub="Manual price log" onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Add'}</Button>} />
      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size count" required value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="e.g. 40" />
            <Field label="Price (₹ per kg)" required type="number" step="any" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="e.g. processor" />
            <Field label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <Button className="w-full">Save price</Button>
        </form>
      )}
      {rows.length === 0 ? (
        <Empty title="No prices yet" body="Log the prices you are quoted, by size count, to see how they move over time." />
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Size">
              {sizes.map((s) => (
                <button key={s} onClick={() => setSel(s)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${s === size ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 text-slate-600'}`}>Count {s}</button>
              ))}
            </div>
            <div className="flex items-baseline justify-between">
              <div className="font-display text-3xl font-semibold tabular-nums">{money(last.price)}<span className="ml-1 text-sm font-normal text-slate-500">/ kg</span></div>
              {prev && <div className={`text-sm font-semibold ${last.price >= prev.price ? 'text-teal-700' : 'text-red-700'}`}>{last.price >= prev.price ? '+' : '−'}{money(Math.abs(last.price - prev.price))} vs previous</div>}
            </div>
            {series.length > 1 && (
              <svg viewBox="0 0 300 64" className="mt-2 h-16 w-full" role="img" aria-label={`Price trend for count ${size}, oldest to newest`}>
                <polyline points={pts} fill="none" stroke="var(--color-chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
          </Card>
          <Card className="divide-y divide-slate-100 px-4">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div><div className="text-[0.9375rem] font-semibold">Count {r.size} · {money(r.price)}/kg</div><div className="text-[0.8125rem] text-slate-500">{fmtDate(r.date)}{r.source ? ` · ${r.source}` : ''}</div></div>
                <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label="Delete price" onClick={() => confirm('Delete this price?') && store.removeItem('prices', r.id)}>Delete</button>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
