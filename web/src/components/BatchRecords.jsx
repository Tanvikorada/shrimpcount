import { useState } from 'react'
import { Button, Card, Badge } from './ui'
import { fmtDate } from '../lib/format'

const Sel = ({ label, value, onChange, children }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <select value={value} onChange={onChange} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">{children}</select>
  </label>
)
const Num = ({ label, value, onChange, unit }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}{unit ? ` (${unit})` : ''}</span>
    <input type="number" step="any" inputMode="decimal" value={value} onChange={onChange}
      className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base" />
  </label>
)
const Txt = ({ label, value, onChange, ...p }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input type="text" value={value} onChange={onChange} {...p} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base" />
  </label>
)

const QUALITY_FIELDS = [
  ['stress', 'Stress test survival', '%'], ['uniformity', 'Size variation (CV)', '%'], ['gut', 'Gut full', '%'], ['deformity', 'Deformities', '%'],
]

/** Records the hatchery's own quality checks per batch. Values are shown as entered; no grade is invented. */
export function QualityChecks({ batch, store }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ stress: '', uniformity: '', gut: '', deformity: '', activity: '', notes: '' })
  const rows = store.quality.filter((q) => q.batchId === batch.id)
  const submit = (e) => {
    e.preventDefault()
    if (!QUALITY_FIELDS.some(([k]) => f[k] !== '') && !f.activity && !f.notes.trim()) return
    store.addItem('quality', { ...f, batchId: batch.id, date: new Date().toISOString() })
    setF({ stress: '', uniformity: '', gut: '', deformity: '', activity: '', notes: '' }); setOpen(false)
  }
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">PL quality checks</h2>
        <button onClick={() => setOpen(!open)} className="py-1 pl-2 text-sm font-semibold text-teal-700">{open ? 'Cancel' : 'Add check'}</button>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            {QUALITY_FIELDS.map(([k, l, u]) => <Num key={k} label={l} unit={u} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          </div>
          <Sel label="Activity" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} of 5</option>)}
          </Sel>
          <Txt label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <Button className="w-full">Save check</Button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Record stress test, size variation, gut fill, deformities and activity for this batch.</p>
      ) : (
        <Card className="divide-y divide-slate-100 px-4">
          {rows.map((q) => (
            <div key={q.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{fmtDate(q.date)}</span>
                <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label="Delete check" onClick={() => confirm('Delete this check?') && store.removeItem('quality', q.id)}>Delete</button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {QUALITY_FIELDS.filter(([k]) => q[k] !== '' && q[k] != null).map(([k, l]) => <Badge key={k}>{l} {q[k]}%</Badge>)}
                {q.activity && <Badge>Activity {q.activity}/5</Badge>}
              </div>
              {q.notes && <div className="mt-1 text-[0.8125rem] text-slate-500">{q.notes}</div>}
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

const RESULT_TONE = { Negative: 'teal', Positive: 'amber', Pending: 'slate' }

/** Disease test results per batch (for example PCR reports). Ask your hatchery which records it must keep. */
export function DiseaseTests({ batch, store }) {
  const [open, setOpen] = useState(false)
  const blank = { test: '', lab: '', sampleDate: '', result: 'Pending', ref: '', notes: '' }
  const [f, setF] = useState(blank)
  const rows = store.tests.filter((t) => t.batchId === batch.id)
  const submit = (e) => {
    e.preventDefault()
    store.addItem('tests', { ...f, test: f.test.trim(), batchId: batch.id })
    setF(blank); setOpen(false)
  }
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Disease tests</h2>
        <button onClick={() => setOpen(!open)} className="py-1 pl-2 text-sm font-semibold text-teal-700">{open ? 'Cancel' : 'Add test'}</button>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <Txt label="Test" required value={f.test} onChange={(e) => setF({ ...f, test: e.target.value })} list="test-names" placeholder="e.g. WSSV PCR" />
          <datalist id="test-names">{['WSSV', 'EHP', 'IHHNV', 'AHPND', 'TSV', 'IMNV'].map((n) => <option key={n} value={n} />)}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Lab" value={f.lab} onChange={(e) => setF({ ...f, lab: e.target.value })} />
            <label className="block"><span className="text-sm font-medium text-slate-700">Sample date</span>
              <input type="date" value={f.sampleDate} onChange={(e) => setF({ ...f, sampleDate: e.target.value })} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Result" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}>
              {['Pending', 'Negative', 'Positive'].map((r) => <option key={r}>{r}</option>)}
            </Sel>
            <Txt label="Report reference" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
          </div>
          <Button className="w-full">Save test</Button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Keep PCR and other test results with the batch they belong to.</p>
      ) : (
        <Card className="divide-y divide-slate-100 px-4">
          {rows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[0.9375rem] font-semibold">{t.test}<Badge tone={RESULT_TONE[t.result]}>{t.result}</Badge></div>
                <div className="text-[0.8125rem] text-slate-500">{[t.lab, t.sampleDate && fmtDate(t.sampleDate), t.ref && `ref ${t.ref}`].filter(Boolean).join(' · ') || 'No details'}</div>
              </div>
              <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label="Delete test" onClick={() => confirm('Delete this test?') && store.removeItem('tests', t.id)}>Delete</button>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}
