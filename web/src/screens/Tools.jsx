import { useState } from 'react'
import { Card, Field, PageHeader } from '../components/ui'
import { t } from '../lib/i18n'
import { survivalRate, tankVolumeL, dailyFeed, fcr, volumetricTotal } from '../lib/calc'

const show = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: d }) : '–')

function Result({ label, value, unit }) {
  return (
    <div className="mt-3 flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3 text-slate-900 ring-1 ring-slate-300">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}<span className="ml-1 text-sm font-normal text-slate-500">{unit}</span></span>
    </div>
  )
}

function useForm(init) {
  const [f, setF] = useState(init)
  return [f, (k) => (e) => setF({ ...f, [k]: e.target.value }), setF]
}

const Section = ({ title, hint, children }) => (
  <Card className="p-4">
    <h2 className="text-base font-semibold">{title}</h2>
    {hint && <p className="mb-3 text-xs text-slate-500">{hint}</p>}
    <div className="space-y-3">{children}</div>
  </Card>
)

export default function Tools({ go }) {
  const [sv, ssv] = useForm({ stocked: '', harvested: '' })
  const [vol, svol, setVol] = useForm({ shape: 'rect', a: '', b: '', d: '' })
  const [fd, sfd] = useForm({ n: '', s: '', w: '', r: '' })
  const [fc, sfc] = useForm({ feed: '', gain: '' })
  const [vt, svt] = useForm({ mean: '', tank: '', sample: '' })

  const feed = dailyFeed(fd.n, fd.s, fd.w, fd.r)
  const litres = tankVolumeL(vol.shape, vol.a, vol.b, vol.d)

  return (
    <>
      <PageHeader title={t('cx_title')} onBack={() => go('/more')} />
      <div className="space-y-4">
        <Section title={t('cx_sv')} hint={t('cx_sv_hint')}>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t('cx_stocked')} type="number" inputMode="decimal" value={sv.stocked} onChange={ssv('stocked')} />
            <Field label={t('cx_harvested')} type="number" inputMode="decimal" value={sv.harvested} onChange={ssv('harvested')} />
          </div>
          <Result label={t('cx_survival')} value={show(survivalRate(sv.stocked, sv.harvested))} unit="%" />
        </Section>

        <Section title={t('cx_vol')}>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('cx_shape')}>
            {[['rect', t('cx_rect')], ['round', t('cx_round')]].map(([k, l]) => (
              <button key={k} onClick={() => setVol({ ...vol, shape: k })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${vol.shape === k ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300'}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 items-end gap-3">
            <Field label={vol.shape === 'round' ? t('cx_diameter') : t('cx_length')} type="number" inputMode="decimal" value={vol.a} onChange={svol('a')} />
            {vol.shape === 'rect' ? <Field label={t('cx_width')} type="number" inputMode="decimal" value={vol.b} onChange={svol('b')} /> : <div />}
            <Field label={t('cx_depth')} type="number" inputMode="decimal" value={vol.d} onChange={svol('d')} />
          </div>
          <Result label={t('cx_volume')} value={show(litres, 0)} unit={t('cx_litres')} />
        </Section>

        <Section title={t('cx_feed')} hint={t('cx_feed_hint')}>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t('cx_count')} type="number" inputMode="decimal" value={fd.n} onChange={sfd('n')} />
            <Field label={t('cx_surv_pct')} type="number" inputMode="decimal" value={fd.s} onChange={sfd('s')} />
            <Field label={t('cx_abw')} type="number" inputMode="decimal" value={fd.w} onChange={sfd('w')} />
            <Field label={t('cx_rate')} type="number" inputMode="decimal" value={fd.r} onChange={sfd('r')} />
          </div>
          <Result label={t('cx_biomass')} value={show(feed.biomassKg, 2)} unit="kg" />
          <Result label={t('cx_feed_day')} value={show(feed.feedKg, 2)} unit="kg" />
          <p className="text-xs text-slate-500">{t('cx_feed_note')}</p>
        </Section>

        <Section title={t('cx_fcr')}>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t('cx_fed')} type="number" inputMode="decimal" value={fc.feed} onChange={sfc('feed')} />
            <Field label={t('cx_gain')} type="number" inputMode="decimal" value={fc.gain} onChange={sfc('gain')} />
          </div>
          <Result label="FCR" value={show(fcr(fc.feed, fc.gain), 2)} unit="" />
        </Section>

        <Section title={t('cx_vt')} hint={t('cx_vt_hint')}>
          <div className="grid grid-cols-3 items-end gap-3">
            <Field label={t('cx_avg')} type="number" inputMode="decimal" value={vt.mean} onChange={svt('mean')} />
            <Field label={t('cx_tank_l')} type="number" inputMode="decimal" value={vt.tank} onChange={svt('tank')} />
            <Field label={t('cx_sample_ml')} type="number" inputMode="decimal" value={vt.sample} onChange={svt('sample')} />
          </div>
          <Result label={t('cx_total')} value={show(volumetricTotal(vt.mean, vt.tank, vt.sample), 0)} unit="PL" />
        </Section>
      </div>
    </>
  )
}
