import { Button, Empty, PageHeader, Badge } from '../components/ui'
import { batchStats } from '../lib/store'
import { fmt, fmtDate, fmtTime, download } from '../lib/format'

const Section = ({ title, children }) => (
  <section className="border-b border-slate-200 py-4 last:border-0">
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
    <div className="mt-2 text-sm">{children}</div>
  </section>
)

/** One printable record of everything held about a batch: counts, production log, water, quality, tests, deliveries. */
export default function Trace({ id, store, go }) {
  const b = store.batches.find((x) => x.id === id)
  if (!b) return <Empty title="Batch not found" body="It may have been deleted." action={<Button onClick={() => go('/batches')}>Back</Button>} />
  const samples = store.samples.filter((s) => s.batchId === id).slice().reverse()
  const events = store.events.filter((e) => e.batchId === id).slice().reverse()
  const quality = store.quality.filter((q) => q.batchId === id)
  const tests = store.tests.filter((t) => t.batchId === id)
  const growth = store.growth.filter((g) => g.batchId === id)
  const water = store.water.filter((w) => w.batchId === id || (b.tank && w.tank === b.tank)).slice().reverse()
  const orders = store.orders.filter((o) => o.batchId === id)
  const st = batchStats(b, store.samples)
  const name = store.settings.hatchery || 'Hatchery'

  const json = () => download(`${b.code}-traceability.json`, JSON.stringify({ hatchery: name, exportedAt: new Date().toISOString(), batch: b, samples: samples.map(({ thumb, ...s }) => s), events, water, quality, tests, growth, orders }, null, 1), 'application/json')

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Traceability" sub={`Batch ${b.code}`} onBack={() => go(`/batch/${id}`)} />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Button onClick={() => window.print()}>Print / PDF</Button>
          <Button variant="ghost" onClick={json}>Download JSON</Button>
        </div>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-surface p-6 print:border-0 print:p-0 print:shadow-none print:ring-0">
        <header className="border-b border-slate-200 pb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">Batch traceability record</div>
          <h2 className="font-display mt-1 text-2xl font-semibold">{name}</h2>
          <div className="text-sm text-slate-500">Generated {fmtDate(new Date().toISOString())}</div>
        </header>

        <Section title="Batch">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[['Code', b.code], ['Tank', b.tank || '–'], ['PL stage', b.plStage || '–'], ['Spawn date', b.spawnDate ? fmtDate(b.spawnDate) : '–'], ['Source', b.source || '–'], ['Status', b.status]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
          </dl>
        </Section>

        <Section title={`Counts (${samples.length})`}>
          {samples.length === 0 ? <p className="text-slate-500">No samples.</p> : (
            <>
              <p className="mb-2 text-slate-600">Average {fmt(st.mean)} per sample{st.n > 1 ? `, CV ${st.cv.toFixed(1)}%` : ''}.</p>
              <table className="w-full"><tbody>{samples.map((s) => (
                <tr key={s.id} className="border-t border-slate-100"><td className="py-1.5">{fmtDate(s.timestamp)} {fmtTime(s.timestamp)}</td>
                  <td className="text-slate-500">{s.method === 'ai' ? 'AI, reviewed' : 'Manual'}{s.predicted != null && s.predicted !== s.count ? ` (AI ${fmt(s.predicted)})` : ''}</td>
                  <td className="text-right font-semibold tabular-nums">{fmt(s.count)}</td></tr>))}</tbody></table>
            </>
          )}
        </Section>

        {events.length > 0 && <Section title="Production log">{events.map((e) => (
          <div key={e.id} className="flex gap-2 py-1"><span className="w-20 shrink-0 text-slate-500">{fmtDate(e.timestamp)}</span><span><b>{e.type}</b>{e.value ? `: ${e.value}` : ''}{e.text ? ` · ${e.text}` : ''}</span></div>))}</Section>}

        {water.length > 0 && <Section title="Water readings">{water.map((w) => (
          <div key={w.id} className="py-1"><span className="text-slate-500">{fmtDate(w.timestamp)} · {w.tank || 'Tank'}</span>{' '}
            {['salinity', 'ph', 'temp', 'do', 'ammonia', 'nitrite', 'alkalinity'].filter((k) => w[k] !== '' && w[k] != null).map((k) => `${k} ${w[k]}`).join(', ')}</div>))}</Section>}

        {quality.length > 0 && <Section title="PL quality checks">{quality.map((q) => (
          <div key={q.id} className="py-1"><span className="text-slate-500">{fmtDate(q.date)}</span>{' '}
            {[q.stress !== '' && `stress test ${q.stress}%`, q.uniformity !== '' && `size CV ${q.uniformity}%`, q.gut !== '' && `gut full ${q.gut}%`, q.deformity !== '' && `deformities ${q.deformity}%`, q.activity && `activity ${q.activity}/5`].filter(Boolean).join(', ')}{q.notes ? ` · ${q.notes}` : ''}</div>))}</Section>}

        {tests.length > 0 && <Section title="Disease tests">{tests.map((t) => (
          <div key={t.id} className="flex items-center gap-2 py-1"><b>{t.test}</b><Badge tone={t.result === 'Negative' ? 'teal' : t.result === 'Positive' ? 'amber' : 'slate'}>{t.result}</Badge>
            <span className="text-slate-500">{[t.lab, t.sampleDate && fmtDate(t.sampleDate), t.ref && `ref ${t.ref}`].filter(Boolean).join(' · ')}</span></div>))}</Section>}

        {growth.length > 0 && <Section title="Growth samples">{growth.slice().reverse().map((g) => (
          <div key={g.id} className="py-1"><span className="text-slate-500">{fmtDate(g.date)}</span> average body weight {g.abw} g</div>))}</Section>}

        {orders.length > 0 && <Section title="Deliveries">{orders.map((o) => (
          <div key={o.id} className="py-1">{o.customer} · {fmt(o.plQuantity)} PL{o.date ? ` · ${fmtDate(o.date)}` : ''} · {o.status}</div>))}</Section>}

        <footer className="pt-2 text-xs text-slate-500">Records are as entered by the hatchery on this device. Generated by ShrimpCount.</footer>
      </article>
    </>
  )
}
