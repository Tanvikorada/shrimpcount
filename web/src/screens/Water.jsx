import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmtDate, fmtTime } from '../lib/format'
import { PARAMS, rangeFor, outOfRange } from '../lib/water'
import { t } from '../lib/i18n'

function Spark({ values }) {
  if (values.length < 2) return <p className="text-xs text-slate-500">{t('wq_trend_need')}</p>
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 300},${50 - ((v - min) / span) * 44 - 3}`).join(' ')
  return (
    <svg viewBox="0 0 300 50" className="h-14 w-full" role="img" aria-label={t('wq_trend_aria')}>
      <polyline points={pts} fill="none" stroke="var(--color-chart)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export default function Water({ store, go }) {
  const { water, batches, settings } = store
  const [open, setOpen] = useState(false)
  const [tank, setTank] = useState('')
  const [batchId, setBatchId] = useState('')
  const [vals, setVals] = useState({})
  const [param, setParam] = useState('ph')
  const [editRanges, setEditRanges] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    store.addItem('water', { tank: tank.trim(), batchId, ...vals, timestamp: new Date().toISOString() })
    setVals({}); setOpen(false)
  }

  const series = water.filter((w) => w[param] !== '' && w[param] != null).slice(0, 20).reverse().map((w) => Number(w[param]))
  const alerts = water.slice(0, 20).flatMap((w) => PARAMS.filter((p) => outOfRange(settings, p.key, w[p.key])).map((p) => ({ w, p })))

  return (
    <>
      <PageHeader title={t('wq_title')} onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? t('cancel') : t('wq_log')}</Button>} />

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('tank_word')} value={tank} onChange={(e) => setTank(e.target.value)} placeholder={t('wq_tank_ph')} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t('fl_batch')}</span>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">
                <option value="">{t('opt_none')}</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PARAMS.map((p) => (
              <Field key={p.key} label={`${t(p.labelKey)}${p.unit ? ` (${p.unit})` : ''}`} type="number" step="any" inputMode="decimal"
                value={vals[p.key] ?? ''} onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })} />
            ))}
          </div>
          <Button className="w-full">{t('wq_save_reading')}</Button>
        </form>
      )}

      {alerts.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">{t('wq_out_of_range')}</div>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
            {alerts.slice(0, 5).map(({ w, p }, i) => <li key={i}>{w.tank || t('tank_word')} · {t(p.labelKey)} {w[p.key]}{p.unit && ` ${p.unit}`} · {fmtDate(w.timestamp)}</li>)}
          </ul>
        </Card>
      )}

      {water.length === 0 ? (
        <Empty title={t('wq_empty_title')} body={t('wq_empty_body')} />
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t('wq_param_group')}>
              {PARAMS.map((p) => (
                <button key={p.key} onClick={() => setParam(p.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${param === p.key ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 text-slate-600'}`}>{t(p.labelKey)}</button>
              ))}
            </div>
            <Spark values={series} />
          </Card>
          <Card className="divide-y divide-slate-100">
            {water.slice(0, 30).map((w) => (
              <div key={w.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{w.tank || t('tank_word')}{w.batchId && batches.find((b) => b.id === w.batchId) ? ` · ${batches.find((b) => b.id === w.batchId).code}` : ''}</div>
                  <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label={t('wq_delete_aria')} onClick={() => confirm(t('wq_delete_confirm')) && store.removeItem('water', w.id)}>{t('delete')}</button>
                </div>
                <div className="text-xs text-slate-500">{fmtDate(w.timestamp)} · {fmtTime(w.timestamp)}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PARAMS.filter((p) => w[p.key] !== '' && w[p.key] != null).map((p) => (
                    <span key={p.key} className={`rounded-md px-2 py-0.5 text-xs font-medium ${outOfRange(settings, p.key, w[p.key]) ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{t(p.labelKey)} {w[p.key]}</span>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('wq_alert_ranges')}</h2>
          <button onClick={() => setEditRanges(!editRanges)} className="text-sm font-medium text-teal-700">{editRanges ? t('done') : t('wq_edit')}</button>
        </div>
        <p className="mb-2 text-xs text-slate-500">{t('wq_ranges_hint')}</p>
        <Card className="divide-y divide-slate-100">
          {PARAMS.map((p) => {
            const [lo, hi] = rangeFor(settings, p.key)
            const set = (i) => (e) => {
              const cur = [...rangeFor(settings, p.key)]
              cur[i] = e.target.value === '' ? null : Number(e.target.value)
              store.setSettings({ ranges: { ...settings.ranges, [p.key]: cur } })
            }
            return (
              <div key={p.key} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="w-24 font-medium">{t(p.labelKey)}</span>
                {editRanges ? (
                  <span className="flex items-center gap-2">
                    <input aria-label={t('wq_min_aria', { label: t(p.labelKey) })} type="number" step="any" defaultValue={lo ?? ''} onBlur={set(0)} placeholder={t('wq_min_ph')} className="w-20 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-2 py-1" />
                    <input aria-label={t('wq_max_aria', { label: t(p.labelKey) })} type="number" step="any" defaultValue={hi ?? ''} onBlur={set(1)} placeholder={t('wq_max_ph')} className="w-20 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-2 py-1" />
                  </span>
                ) : lo == null && hi == null ? <Badge>{t('wq_no_alert')}</Badge> : <span className="text-slate-600">{lo != null && hi != null ? t('wq_range_between', { lo, hi }) : lo != null ? t('wq_range_min', { lo }) : t('wq_range_max', { hi })} {p.unit}</span>}
              </div>
            )
          })}
        </Card>
      </div>
    </>
  )
}
