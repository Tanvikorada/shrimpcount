import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmtDate } from '../lib/format'
import { fitLine, daysToTarget } from '../lib/growth'
import { t } from '../lib/i18n'

const DAY = 86400000

/** Log average body weight per batch and get a straight-line projection to a target weight. It is a projection, not a guarantee. */
export default function Growth({ store, go }) {
  const [batchId, setBatchId] = useState('')
  const [open, setOpen] = useState(false)
  const [abw, setAbw] = useState('')
  const [target, setTarget] = useState('')
  const batch = store.batches.find((b) => b.id === batchId) || store.batches[0]
  if (!batch) return <><PageHeader title={t('gr_title')} onBack={() => go('/more')} /><Empty title={t('gr_empty_title')} body={t('gr_empty_body')} action={<Button onClick={() => go('/batches/new')}>{t('home_new_batch')}</Button>} /></>

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
      <PageHeader title={t('gr_title')} sub={t('gr_sub')} onBack={() => go('/more')} right={<Button onClick={() => setOpen(!open)}>{open ? t('cancel') : t('gr_log')}</Button>} />
      <label className="mb-3 block">
        <span className="text-sm font-medium text-slate-700">{t('fl_batch')}</span>
        <select value={batch.id} onChange={(e) => setBatchId(e.target.value)} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">
          {store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}{b.plStage ? ` (${b.plStage})` : ''}</option>)}
        </select>
      </label>
      {open && (
        <form onSubmit={submit} className="mb-4 flex items-end gap-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="flex-1"><Field label={t('gr_abw_label')} type="number" step="any" inputMode="decimal" value={abw} onChange={(e) => setAbw(e.target.value)} /></div>
          <Button className="min-h-12">{t('save')}</Button>
        </form>
      )}

      <Card className="mb-4 p-4">
        <Field label={t('gr_target_label')} type="number" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t('gr_target_ph')} />
        {rows.length < 3 ? (
          <p className="mt-3 text-sm text-slate-500">{t('gr_need_samples', { n: rows.length })}</p>
        ) : (
          <div className="mt-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('gr_chart_aria')}>
              {tgt > 0 && <line x1="0" x2={W} y1={y(tgt)} y2={y(tgt)} stroke="var(--color-coral-700)" strokeDasharray="4 4" />}
              {line && <line x1={x(0)} x2={x(maxDay)} y1={y(line.intercept)} y2={y(line.intercept + line.slope * maxDay)} stroke="var(--color-chart)" strokeOpacity="0.4" strokeWidth="2" />}
              {points.map((p, i) => <circle key={i} cx={x(p.day)} cy={y(p.w)} r="4.5" fill="var(--color-chart)" />)}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {line && <Badge tone="teal">{t('gr_rate', { n: line.slope.toFixed(2) })}</Badge>}
              {tgt > 0 && (days == null ? <Badge>{t('gr_no_projection')}</Badge> : days === 0 ? <Badge tone="teal">{t('gr_target_reached')}</Badge> : <Badge tone="amber">{t('gr_days_more', { n: days, t: tgt })}</Badge>)}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('gr_trend_note')}</p>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="divide-y divide-slate-100 px-4">
          {rows.slice().reverse().map((g) => (
            <div key={g.id} className="flex items-center justify-between py-3">
              <div><span className="text-[0.9375rem] font-semibold">{g.abw} g</span> <span className="text-[0.8125rem] text-slate-500">· {fmtDate(g.date)}</span></div>
              <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label={t('gr_delete_aria')} onClick={() => confirm(t('gr_delete_confirm')) && store.removeItem('growth', g.id)}>{t('delete')}</button>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
