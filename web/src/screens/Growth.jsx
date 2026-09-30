import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmtDate } from '../lib/format'
import { fitLine, daysToTarget } from '../lib/growth'

const DAY = 86400000

/** Log average body weight per batch and get a straight-line projection to a target weight. It is a projection, not a guarantee. */
export default function Growth({ store, go }) {
  const [batchId, setBatchId] = useState('')
  const [open, setOpen] = useState(false)
  const [abw, setAbw] = useState('')
  const [target, setTarget] = useState('')
  const batch = store.batches.find((b) => b.id === batchId) || store.batches[0]
  if (!batch) return <><PageHeader title="Growth" onBack={() => go('/more')} /><Empty title="No batches yet" body="Create a batch first, then log body-weight samples against it." action={<Button onClick={() => go('/batches/new')}>New batch</Button>} /></>

  const rows = store.growth.filter((g) => g.batchId === batch.id).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const t0 = rows.length ? new Date(rows[0].date).getTime() : 0
  const points = rows.map((g) => ({ day: (new Date(g.date).getTime() - t0) / DAY, w: Number(g.abw) }))
  const line = fitLine(points)
  const tgt = Number(target || batch.targetWeight || 0)
  const days = daysToTarget(points, tgt)

  const submit = (e) => {
    e.preventDefault()
    if (!(Number(abw) > 0)) return
    store.addItem('growth', { batchId: batch.id, abw: Number(abw), date: new Date().toISOString() })
    setAbw(''); setOpen(false)
  }

  const W = 300, H = 90
  const ws = points.map((p) => p.w), maxDay = Math.max(1, ...points.map((p) => p.day))
  const lo = Math.min(...ws, 0), hi = Math.max(...ws, tgt || 0) || 1
  const x = (d) => 8 + (d / maxDay) * (W - 16)
  const y = (w) => H - 8 - ((w - lo) / (hi - lo || 1)) * (H - 16)

  return (
    <>
      <PageHeader title="Growth" sub="Average body weight" onBack={() => go('/more')} right={<Button onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Log weight'}</Button>} />
      <label className="mb-3 block">
        <span className="text-sm font-medium text-slate-700">Batch</span>
        <select value={batch.id} onChange={(e) => setBatchId(e.target.value)} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">
          {store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}{b.plStage ? ` (${b.plStage})` : ''}</option>)}
        </select>
      </label>
      {open && (
        <form onSubmit={submit} className="mb-4 flex items-end gap-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="flex-1"><Field label="Average body weight (g)" type="number" step="any" inputMode="decimal" value={abw} onChange={(e) => setAbw(e.target.value)} /></div>
          <Button className="min-h-12">Save</Button>
        </form>
      )}

      <Card className="mb-4 p-4">
        <Field label="Target weight (g)" type="number" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 20" />
        {rows.length < 3 ? (
          <p className="mt-3 text-sm text-slate-500">Log at least 3 weight samples to see a projection. {rows.length} so far.</p>
        ) : (
          <div className="mt-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Average body weight over time">
              {tgt > 0 && <line x1="0" x2={W} y1={y(tgt)} y2={y(tgt)} stroke="#c2410c" strokeDasharray="4 4" />}
              {line && <line x1={x(0)} x2={x(maxDay)} y1={y(line.intercept)} y2={y(line.intercept + line.slope * maxDay)} stroke="var(--color-chart)" strokeOpacity="0.4" strokeWidth="2" />}
              {points.map((p, i) => <circle key={i} cx={x(p.day)} cy={y(p.w)} r="4.5" fill="var(--color-chart)" />)}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {line && <Badge tone="teal">{line.slope.toFixed(2)} g per day</Badge>}
              {tgt > 0 && (days == null ? <Badge>No projection</Badge> : days === 0 ? <Badge tone="teal">Target reached on this trend</Badge> : <Badge tone="amber">About {days} more day{days === 1 ? '' : 's'} to {tgt} g</Badge>)}
            </div>
            <p className="mt-2 text-xs text-slate-500">A straight line through your samples. Real growth slows or speeds with feed, water and density, so check against fresh samples.</p>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="divide-y divide-slate-100 px-4">
          {rows.slice().reverse().map((g) => (
            <div key={g.id} className="flex items-center justify-between py-3">
              <div><span className="text-[0.9375rem] font-semibold">{g.abw} g</span> <span className="text-[0.8125rem] text-slate-500">· {fmtDate(g.date)}</span></div>
              <button className="text-xs text-red-700" aria-label="Delete weight" onClick={() => confirm('Delete this weight?') && store.removeItem('growth', g.id)}>Delete</button>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
