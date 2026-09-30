import { Button, Empty, PageHeader } from '../components/ui'
import { DocFooter, DocHeader, SignBlock, useEvidence } from '../components/Doc'
import { batchStats } from '../lib/store'
import { fmt, fmtDate, fmtTime, shareText, steadiness, words , docDate, docTime, docSteadiness } from '../lib/format'
import { Share } from '../components/icons'
import { t } from '../lib/i18n'

// The document a hatchery hands to a customer. It should look official and settle "how many did you count?": the marked
// photos are the evidence, the method is stated plainly, and there is room to sign.
export default function Report({ id, store, go }) {
  const batch = store.batches.find((b) => b.id === id)
  const list = store.samples.filter((s) => s.batchId === id).slice().reverse()
  const photos = useEvidence(list.slice().reverse(), 4)

  if (!batch || !list.length) return <Empty title="No report" body="Count at least one sample first." action={<Button onClick={() => go('/batches')}>Back</Button>} />
  const st = batchStats(batch, store.samples)
  const name = store.settings.hatchery || 'Hatchery'
  const issued = new Date()
  const number = `PLC-${issued.toISOString().slice(0, 10).replace(/-/g, '')}-${batch.id.slice(0, 4).toUpperCase()}`
  const added = list.reduce((a, s) => a + (s.added || 0), 0)
  const removed = list.reduce((a, s) => a + (s.removed || 0), 0)
  const summary = `${name} · Batch ${batch.code}${batch.plStage ? ` (${batch.plStage})` : ''}\n${st.n} count${st.n === 1 ? '' : 's'}, average ${fmt(st.mean)} PL per sample${st.estTotal != null ? `\nEstimated tank total: ${fmt(st.estTotal)} (volumetric estimate)` : ''}\nReport ${number}`
  const steady = st.n > 1 ? docSteadiness(st.cv) : null

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={t('rp_title')} onBack={() => go(`/batch/${id}`)} />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Button onClick={() => window.print()}>{t('od_print')}</Button>
          <Button variant="ghost" onClick={() => shareText(summary)}><Share width={18} />{t('od_share')}</Button>
        </div>
      </div>

      <article className="rounded-3xl bg-surface p-6 ring-1 ring-white/[0.09] print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <DocHeader label="Postlarvae count report" name={name} number={number} date={issued} />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-slate-200 py-4 text-sm sm:grid-cols-3">
          {[['Batch', batch.code], ['Tank', batch.tank || '–'], ['PL stage', batch.plStage || '–'], ['Shrimp type', batch.species || '–'],
            ['Spawn date', batch.spawnDate ? docDate(batch.spawnDate) : '–'], ['Counted by', store.settings.operator || '–']].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 py-5">
          <div>
            <div className="text-[2.25rem] font-bold leading-none tabular-nums tracking-tight text-slate-900">{fmt(st.mean)}</div>
            <div className="mt-1 text-[0.8125rem] text-slate-500">Average PL per sample{st.shots > st.n ? ` (${st.n} trays)` : ` (${st.n} count${st.n === 1 ? '' : 's'})`}</div>
          </div>
          <div>
            <div className="text-[1.5rem] font-bold leading-none text-slate-900">{steady ? steady.text : '–'}</div>
            <div className="mt-1 text-[0.8125rem] text-slate-500">{steady ? `Between samples: ${st.cv.toFixed(1)}% spread` : 'Needs two or more counts'}</div>
          </div>
          {st.estTotal != null && (
            <div className="col-span-2 rounded-2xl bg-teal-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">Estimated tank total</div>
              <div className="mt-1 text-[1.75rem] font-bold tabular-nums tracking-tight text-teal-900">{fmt(st.estTotal)}</div>
              {words(st.estTotal) && <div className="text-[1.0625rem] font-semibold text-teal-800">≈ {words(st.estTotal)}</div>}
              <div className="text-[0.75rem] text-teal-900/80">Average sample × {fmt(Number(batch.tankVolumeL) * 1000 / Number(batch.sampleVolumeMl))}. A volumetric estimate, not a direct count of the whole tank.</div>
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <section className="border-b border-slate-200 py-5 print:break-inside-avoid">
            <h3 className="mb-3 text-[0.9375rem] font-bold text-slate-900">Counted photos</h3>
            <div className={`grid gap-3 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {photos.map((p) => (
                <figure key={p.id} className="print:break-inside-avoid">
                  <img src={p.url} alt={`Counted tray, ${fmt(p.count)}`} className="w-full rounded-xl" />
                </figure>
              ))}
            </div>
            <p className="mt-2 text-[0.75rem] text-slate-500">Each ring is one larva counted. Rings and the dashed tray outline are drawn on the original photo.</p>
          </section>
        )}

        <table className="mt-5 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="w-8 pb-2">#</th><th>Date and time</th><th>Type</th><th className="text-right">Count</th></tr></thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-500">{i + 1}</td>
                <td>{docDate(s.timestamp)} · {docTime(s.timestamp)}</td>
                <td>{s.method === 'ai' ? 'Photo count, checked' : 'Counted by hand'}</td>
                <td className="text-right font-semibold tabular-nums">{fmt(s.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 rounded-2xl bg-slate-50 p-4 text-[0.8125rem] leading-relaxed text-slate-600 print:break-inside-avoid">
          <div className="mb-1 font-semibold text-slate-800">How this was counted</div>
          Each count is from a photo of the sample in a standard tray. The app finds the larvae, and the operator checks the marks against the photo
          {added + removed > 0 ? ` (across these counts, ${added} larva${added === 1 ? ' was' : 'e were'} added and ${removed} removed by hand)` : ''}.
          Counts are per sample. Any tank total is an estimate from the sample volume. This report states the counts recorded; it is not a laboratory certificate.
        </section>

        <SignBlock items={[['Counted by', store.settings.operator], ['Checked by / date']]} />
        <DocFooter number={number} />
      </article>
    </>
  )
}
