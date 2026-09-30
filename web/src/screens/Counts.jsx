import { useMemo, useState } from 'react'
import { Badge, Button, Card, Empty, PageHeader } from '../components/ui'
import { countsCsv, filterCounts, SPECIES } from '../lib/counts'
import { download, fmt, fmtDate, fmtTime } from '../lib/format'
import { t } from '../lib/i18n'

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// Every count across all batches, with a date-range filter and a download.
export default function Counts({ store, go }) {
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [species, setSpecies] = useState('')
  const [batchId, setBatchId] = useState('')
  const rows = useMemo(() => filterCounts(store.samples, { from, to, species, batchId }), [store.samples, from, to, species, batchId])
  const byId = useMemo(() => new Map(store.batches.map((b) => [b.id, b])), [store.batches])
  const sel = 'mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3 py-2.5 text-[0.9375rem]'

  return (
    <>
      <PageHeader title={t('h_title')} sub={t('h_sub', { n: rows.length })} onBack={() => go('/more')}
        right={<Button variant="ghost" disabled={!rows.length} onClick={() => download(`counts_${from}_to_${to}.csv`, countsCsv(rows, store.batches))}>{t('h_download')}</Button>} />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700">{t('h_from')}<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={sel} /></label>
          <label className="text-sm font-medium text-slate-700">{t('h_to')}<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={sel} /></label>
          <label className="text-sm font-medium text-slate-700">{t('shrimp_type')}
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className={sel}><option value="">{t('all')}</option>{SPECIES.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-slate-700">{t('nb_code')}
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={sel}><option value="">{t('all')}</option>{store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
          </label>
        </div>
        <div className="mt-3 flex gap-2 text-[0.8125rem]">
          {[[t('h_7'), 7], [t('h_30'), 30], [t('h_90'), 90]].map(([l, n]) => (
            <button key={l} onClick={() => { setFrom(daysAgo(n)); setTo(today()) }} className="rounded-full ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3 py-1 font-medium text-slate-700">{l}</button>
          ))}
        </div>
      </Card>

      {!rows.length ? (
        <Empty title={t('h_none')} body={t('h_none_body')} />
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const b = byId.get(s.batchId)
            return (
              <li key={s.id}>
                <Card>
                  <button onClick={() => b && go(`/batch/${b.id}`)} className="flex w-full items-center gap-3 p-3 text-left">
                    {s.thumb ? <img src={s.thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-200" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-lg font-semibold tabular-nums">{fmt(s.count)}</span>
                        {s.species && <Badge tone="teal">{s.species}</Badge>}
                        {b?.plStage && <Badge>{b.plStage}</Badge>}
                      </div>
                      <div className="truncate text-sm text-slate-500">{b?.code || '—'} · {fmtDate(s.timestamp)} {fmtTime(s.timestamp)}</div>
                      {(s.added > 0 || s.removed > 0) && <div className="text-xs text-amber-800">{t('h_edited', { a: s.added || 0, r: s.removed || 0 })}</div>}
                    </div>
                  </button>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
