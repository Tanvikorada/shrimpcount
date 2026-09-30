import { SPECIES } from '../lib/counts'
import { useState } from 'react'
import { Card, Empty, Button, Badge, Field, PageHeader } from '../components/ui'
import { batchStats } from '../lib/store'
import { fmt, fmtDate } from '../lib/format'
import { Plus } from '../components/icons'
import { t } from '../lib/i18n'

export function BatchList({ store, go }) {
  const { batches, samples } = store
  return (
    <>
      <PageHeader title={t('b_title')} sub={t('b_sub')}
        right={<Button onClick={() => go('/batches/new')}><Plus width={18} />{t('new')}</Button>} />
      {batches.length === 0 ? (
        <Empty title={t('b_none')} body={t('b_none_body')}
          action={<Button onClick={() => go('/batches/new')}>{t('b_create_first')}</Button>} />
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const st = batchStats(b, samples)
            return (
              <Card key={b.id}>
                <button className="flex min-h-[4.75rem] w-full items-center justify-between gap-3 p-4 text-left" onClick={() => go(`/batch/${b.id}`)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[1.0625rem] font-bold tracking-tight text-slate-900">{b.code}</span>
                      {b.plStage && <Badge tone="teal">{b.plStage}</Badge>}
                      {b.status === 'closed' && <Badge>{t('b_closed')}</Badge>}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] text-slate-500">{b.tank ? `${t('tank_n', { t: b.tank })} · ` : ''}{t('b_created', { d: fmtDate(b.createdAt) })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[1.5rem] font-bold leading-none tabular-nums tracking-tight text-slate-900">{st.n ? fmt(st.mean) : '–'}</div>
                    <div className="text-xs text-slate-500">{t('counts_n', { n: st.n })}</div>
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

// A ready name so nobody has to invent one: B-<year><month>-<next number this month>. It can be changed.
const nextCode = (batches) => {
  const d = new Date(), pre = `B-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`
  const n = batches.filter((b) => String(b.code).startsWith(pre)).length + 1
  return `${pre}${String(n).padStart(2, '0')}`
}

export function NewBatch({ store, go }) {
  const [f, setF] = useState({ code: nextCode(store.batches), tank: '', plStage: '', species: 'Vannamei', spawnDate: '', source: '', tankVolumeL: '', sampleVolumeMl: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    const b = store.addBatch({ ...f, code: f.code.trim() })
    go(`/batch/${b.id}`)
  }
  return (
    <>
      <PageHeader title={t('nb_title')} onBack={() => go('/batches')} />
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('nb_code')} required value={f.code} onChange={set('code')} placeholder="e.g. B-2609-01" />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('nb_tank')} value={f.tank} onChange={set('tank')} placeholder="e.g. T4" />
          <Field label={t('nb_stage')} value={f.plStage} onChange={set('plStage')} placeholder="e.g. PL12" />
        </div>
        <details className="group rounded-2xl bg-surface ring-1 ring-slate-200">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 text-[0.9375rem] font-semibold text-slate-800">{t('nb_more')}<span className="text-slate-400 transition group-open:rotate-90">›</span></summary>
          <div className="space-y-4 px-4 pb-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t('shrimp_type')}</span>
              <select value={f.species} onChange={set('species')} className="mt-1 min-h-12 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 text-base">
                {SPECIES.map((x) => <option key={x} value={x}>{x === 'Other' ? t('species_other') : x}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('nb_spawn')} type="date" value={f.spawnDate} onChange={set('spawnDate')} />
              <Field label={t('nb_source')} value={f.source} onChange={set('source')} />
            </div>
            <div className="rounded-2xl bg-slate-100 p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">{t('nb_optional')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('nb_tank_vol')} type="number" inputMode="decimal" value={f.tankVolumeL} onChange={set('tankVolumeL')} />
                <Field label={t('nb_sample_vol')} type="number" inputMode="decimal" value={f.sampleVolumeMl} onChange={set('sampleVolumeMl')} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{t('nb_note')}</p>
            </div>
          </div>
        </details>
        <Button className="w-full">{t('nb_create')}</Button>
      </form>
    </>
  )
}
