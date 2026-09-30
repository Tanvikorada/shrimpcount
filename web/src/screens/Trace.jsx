import { Button, Empty, PageHeader, Badge } from '../components/ui'
import { batchStats } from '../lib/store'
import { fmt, fmtDate, fmtTime, download } from '../lib/format'
import { t } from '../lib/i18n'

const Section = ({ title, children }) => (
  <section className="border-b border-slate-200 py-4 last:border-0">
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
    <div className="mt-2 text-sm">{children}</div>
  </section>
)

/** One printable record of everything held about a batch: counts, production log, water, quality, tests, deliveries. */
export default function Trace({ id, store, go }) {
  const b = store.batches.find((x) => x.id === id)
  if (!b) return <Empty title={t('tc_not_found_title')} body={t('tc_not_found_body')} action={<Button onClick={() => go('/batches')}>{t('back')}</Button>} />
  const samples = store.samples.filter((s) => s.batchId === id).slice().reverse()
  const events = store.events.filter((e) => e.batchId === id).slice().reverse()
  const quality = store.quality.filter((q) => q.batchId === id)
  const tests = store.tests.filter((k) => k.batchId === id)
  const growth = store.growth.filter((g) => g.batchId === id)
  const water = store.water.filter((w) => w.batchId === id || (b.tank && w.tank === b.tank)).slice().reverse()
  const orders = store.orders.filter((o) => o.batchId === id)
  const st = batchStats(b, store.samples)
  const name = store.settings.hatchery || t('tc_hatchery_fallback')

  const json = () => download(`${b.code}-traceability.json`, JSON.stringify({ hatchery: name, exportedAt: new Date().toISOString(), batch: b, samples: samples.map(({ thumb, ...s }) => s), events, water, quality, tests, growth, orders }, null, 1), 'application/json')

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={t('tc_title')} sub={t('batch_code', { code: b.code })} onBack={() => go(`/batch/${id}`)} />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Button onClick={() => window.print()}>{t('tc_print')}</Button>
          <Button variant="ghost" onClick={json}>{t('tc_download_json')}</Button>
        </div>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-surface p-6 print:border-0 print:p-0 print:shadow-none print:ring-0">
        <header className="border-b border-slate-200 pb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">{t('tc_header_kicker')}</div>
          <h2 className="font-display mt-1 text-2xl font-semibold">{name}</h2>
          <div className="text-sm text-slate-500">{t('tc_generated', { date: fmtDate(new Date().toISOString()) })}</div>
        </header>

        <Section title={t('fl_batch')}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[[t('fl_code'), b.code], [t('tank_word'), b.tank || '–'], [t('fl_pl_stage'), b.plStage || '–'], [t('fl_spawn_date'), b.spawnDate ? fmtDate(b.spawnDate) : '–'], [t('fl_source'), b.source || '–'], [t('fl_status'), b.status]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
          </dl>
        </Section>

        <Section title={t('tc_section_counts', { n: samples.length })}>
          {samples.length === 0 ? <p className="text-slate-500">{t('tc_no_samples')}</p> : (
            <>
              <p className="mb-2 text-slate-600">{st.n > 1 ? t('tc_avg_cv', { n: fmt(st.mean), cv: st.cv.toFixed(1) }) : t('tc_avg', { n: fmt(st.mean) })}.</p>
              <table className="w-full"><tbody>{samples.map((s) => (
                <tr key={s.id} className="border-t border-slate-100"><td className="py-1.5">{fmtDate(s.timestamp)} {fmtTime(s.timestamp)}</td>
                  <td className="text-slate-500">{s.method === 'ai' ? t('tc_ai_reviewed') : t('tc_manual')}{s.predicted != null && s.predicted !== s.count ? ` (AI ${fmt(s.predicted)})` : ''}</td>
                  <td className="text-right font-semibold tabular-nums">{fmt(s.count)}</td></tr>))}</tbody></table>
            </>
          )}
        </Section>

        {events.length > 0 && <Section title={t('tc_section_prodlog')}>{events.map((e) => (
          <div key={e.id} className="flex gap-2 py-1"><span className="w-20 shrink-0 text-slate-500">{fmtDate(e.timestamp)}</span><span><b>{e.type}</b>{e.value ? `: ${e.value}` : ''}{e.text ? ` · ${e.text}` : ''}</span></div>))}</Section>}

        {water.length > 0 && <Section title={t('tc_section_water')}>{water.map((w) => (
          <div key={w.id} className="py-1"><span className="text-slate-500">{fmtDate(w.timestamp)} · {w.tank || t('tank_word')}</span>{' '}
            {['salinity', 'ph', 'temp', 'do', 'ammonia', 'nitrite', 'alkalinity'].filter((k) => w[k] !== '' && w[k] != null).map((k) => `${k} ${w[k]}`).join(', ')}</div>))}</Section>}

        {quality.length > 0 && <Section title={t('tc_section_quality')}>{quality.map((q) => (
          <div key={q.id} className="py-1"><span className="text-slate-500">{fmtDate(q.date)}</span>{' '}
            {[q.stress !== '' && t('tc_stress_test', { n: q.stress }), q.uniformity !== '' && t('tc_size_cv', { n: q.uniformity }), q.gut !== '' && t('tc_gut_full', { n: q.gut }), q.deformity !== '' && t('tc_deformities', { n: q.deformity }), q.activity && t('tc_activity', { n: q.activity })].filter(Boolean).join(', ')}{q.notes ? ` · ${q.notes}` : ''}</div>))}</Section>}

        {tests.length > 0 && <Section title={t('tc_section_tests')}>{tests.map((k) => (
          <div key={k.id} className="flex items-center gap-2 py-1"><b>{k.test}</b><Badge tone={k.result === 'Negative' ? 'teal' : k.result === 'Positive' ? 'amber' : 'slate'}>{k.result}</Badge>
            <span className="text-slate-500">{[k.lab, k.sampleDate && fmtDate(k.sampleDate), k.ref && t('tc_ref', { n: k.ref })].filter(Boolean).join(' · ')}</span></div>))}</Section>}

        {growth.length > 0 && <Section title={t('tc_section_growth')}>{growth.slice().reverse().map((g) => (
          <div key={g.id} className="py-1"><span className="text-slate-500">{fmtDate(g.date)}</span> {t('tc_abw_line', { n: g.abw })}</div>))}</Section>}

        {orders.length > 0 && <Section title={t('tc_section_deliveries')}>{orders.map((o) => (
          <div key={o.id} className="py-1">{o.customer} · {fmt(o.plQuantity)} {t('tc_pl_unit')}{o.date ? ` · ${fmtDate(o.date)}` : ''} · {o.status}</div>))}</Section>}

        <footer className="pt-2 text-xs text-slate-500">{t('tc_footer')}</footer>
      </article>
    </>
  )
}
