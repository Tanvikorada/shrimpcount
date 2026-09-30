import { Card, Stat, Button, Badge, Empty, PageHeader } from '../components/ui'
import { batchStats } from '../lib/store'
import { fmt, fmtDate, fmtTime, csv, download, words, steadiness } from '../lib/format'
import { t } from '../lib/i18n'
import { evidenceRemove, labelRemove } from '../lib/evidence'
import { goCount } from '../lib/demo'
import { useCloud } from '../lib/cloud'
import { Camera, Doc } from '../components/icons'
import BatchLog from '../components/BatchLog'
import Consistency from '../components/Consistency'
import { QualityChecks, DiseaseTests } from '../components/BatchRecords'

export default function BatchDetail({ id, store, go }) {
  const cloud = useCloud()
  const batch = store.batches.find((b) => b.id === id)
  if (!batch) return <Empty title="Batch not found" body="It may have been deleted." action={<Button onClick={() => go('/batches')}>Back to batches</Button>} />
  const list = store.samples.filter((s) => s.batchId === id)
  const st = batchStats(batch, store.samples)
  const extras = !!store.settings.showExtras // batch records that are not about counting

  const remove = () => {
    if (confirm(t('d_delete_batch_confirm', { code: batch.code, n: list.length }))) {
      list.forEach((x) => { evidenceRemove(x.id); labelRemove(x.id) })
      store.deleteBatch(id)
      go('/batches')
    }
  }

  return (
    <>
      <PageHeader title={batch.code} onBack={() => go('/batches')}
        sub={[batch.tank && t('tank_n', { t: batch.tank }), batch.species, batch.plStage, batch.spawnDate && t('d_spawned', { d: fmtDate(batch.spawnDate) })].filter(Boolean).join(' · ')}
        right={batch.status === 'closed' ? <Badge>{t('d_closed')}</Badge> : <Badge tone="teal">{t('d_active')}</Badge>} />

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => goCount(store, cloud, go, id)} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-base font-semibold text-on-accent active:bg-teal-900"><Camera width={22} height={22} />{t('d_new_count')}</button>
        <button disabled={!st.n} onClick={() => go(`/report/${id}`)} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-4 text-base font-semibold text-slate-800 disabled:opacity-50 active:bg-slate-100"><Doc width={22} height={22} />{t('d_report')}</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label={t('d_avg')} value={st.n ? fmt(st.mean) : '–'} sub={st.shots > st.n ? t('d_trays_photos', { n: st.n, m: st.shots }) : t('counts_n', { n: st.n })} />
        <Stat label={t('d_between')} value={st.n > 1 ? steadiness(st.cv).text : '–'} sub={st.n > 1 ? `${t('d_spread', { p: st.cv.toFixed(1) })} · ${fmt(st.min)}–${fmt(st.max)}` : t('d_needs2')} />
      </div>
      {st.estTotal != null && (
        <Card className="mt-3 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('d_tank_total')}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(st.estTotal)}{words(st.estTotal) && <span className="ml-2 text-base font-medium text-slate-500">≈ {words(st.estTotal)}</span>}</div>
          <div className="text-xs text-slate-500">{t('d_tank_note')}</div>
        </Card>
      )}

      <Consistency counts={list.slice().reverse().map((x) => Number(x.count))} />

      <h2 className="mb-2.5 mt-8 px-1 text-[1.25rem] font-bold tracking-tight text-slate-900">{t('d_counts_h')}</h2>
      {list.length === 0 ? (
        <p className="text-[0.9375rem] text-slate-500">{t('d_none')}</p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.map((s) => {
            const photos = s.trayId ? list.filter((x) => x.trayId === s.trayId).length : 1
            return (
              <div key={s.id} className="flex min-h-[4.5rem] items-center gap-3 p-3">
                {s.thumb ? <img src={s.thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[1.375rem] font-bold tabular-nums tracking-tight text-slate-900">{fmt(s.count)}</span>
                    {s.method !== 'ai' && <Badge tone="amber">{t('d_by_hand')}</Badge>}
                  </div>
                  <div className="text-[0.8125rem] leading-snug text-slate-500">
                    {fmtDate(s.timestamp)} · {fmtTime(s.timestamp)}{photos > 1 ? ` · ${t('d_of_photos', { n: photos })}` : ''}
                    {s.aiPending ? ` · ${t('d_waiting')}` : ''}{s.notes ? ` · ${s.notes}` : ''}
                  </div>
                </div>
                <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.875rem] font-semibold text-red-700 active:bg-red-50" aria-label="Delete sample"
                  onClick={() => confirm(t('d_delete_confirm')) && (evidenceRemove(s.id), labelRemove(s.id), store.deleteSample(s.id))}>{t('delete')}</button>
              </div>
            )
          })}
        </Card>
      )}

      {extras && (
        <>
          <BatchLog batch={batch} events={store.events.filter((e) => e.batchId === id)} store={store} />
          <QualityChecks batch={batch} store={store} />
          <DiseaseTests batch={batch} store={store} />
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {extras && <Button variant="ghost" onClick={() => go(`/trace/${id}`)}>Traceability record</Button>}
        <Button variant="ghost" disabled={!list.length} onClick={() => download(`${batch.code}.csv`, csv(batch, list))}>{t('d_export')}</Button>
        <Button variant="ghost" onClick={() => store.updateBatch(id, { status: batch.status === 'active' ? 'closed' : 'active' })}>
          {batch.status === 'active' ? t('d_close') : t('d_reopen')}</Button>
        <Button variant="danger" onClick={remove}>{t('d_delete_batch')}</Button>
      </div>
    </>
  )
}
