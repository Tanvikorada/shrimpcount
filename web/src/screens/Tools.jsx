import { useState } from 'react'
import { Card, Field, PageHeader } from '../components/ui'
import { survivalRate, tankVolumeL, dailyFeed, fcr, volumetricTotal } from '../lib/calc'

const show = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: d }) : '–')

function Result({ label, value, unit }) {
  return (
    <div className="mt-3 flex items-baseline justify-between rounded-xl bg-slate-900 px-4 py-3 text-on-accent">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}<span className="ml-1 text-sm font-normal text-slate-400">{unit}</span></span>
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
      <PageHeader title="Calculators" onBack={() => go('/more')} />
      <div className="space-y-4">
        <Section title="Survival rate" hint="Harvested (or produced) as a percentage of stocked.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stocked" type="number" inputMode="decimal" value={sv.stocked} onChange={ssv('stocked')} />
            <Field label="Harvested / produced" type="number" inputMode="decimal" value={sv.harvested} onChange={ssv('harvested')} />
          </div>
          <Result label="Survival" value={show(survivalRate(sv.stocked, sv.harvested))} unit="%" />
        </Section>

        <Section title="Tank volume">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tank shape">
            {[['rect', 'Rectangular'], ['round', 'Round']].map(([k, l]) => (
              <button key={k} onClick={() => setVol({ ...vol, shape: k })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${vol.shape === k ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300'}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={vol.shape === 'round' ? 'Diameter (m)' : 'Length (m)'} type="number" inputMode="decimal" value={vol.a} onChange={svol('a')} />
            {vol.shape === 'rect' ? <Field label="Width (m)" type="number" inputMode="decimal" value={vol.b} onChange={svol('b')} /> : <div />}
            <Field label="Water depth (m)" type="number" inputMode="decimal" value={vol.d} onChange={svol('d')} />
          </div>
          <Result label="Volume" value={show(litres, 0)} unit="litres" />
        </Section>

        <Section title="Daily feed" hint="Biomass = stocked × survival × average body weight. Feed = biomass × feeding rate.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stocked count" type="number" inputMode="decimal" value={fd.n} onChange={sfd('n')} />
            <Field label="Survival (%)" type="number" inputMode="decimal" value={fd.s} onChange={sfd('s')} />
            <Field label="Avg body weight (g)" type="number" inputMode="decimal" value={fd.w} onChange={sfd('w')} />
            <Field label="Feeding rate (% of biomass)" type="number" inputMode="decimal" value={fd.r} onChange={sfd('r')} />
          </div>
          <Result label="Biomass" value={show(feed.biomassKg, 2)} unit="kg" />
          <Result label="Feed per day" value={show(feed.feedKg, 2)} unit="kg" />
          <p className="text-xs text-slate-500">Use the feeding rate from your feed supplier's table. This tool does not choose one for you.</p>
        </Section>

        <Section title="Feed conversion ratio (FCR)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Feed given (kg)" type="number" inputMode="decimal" value={fc.feed} onChange={sfc('feed')} />
            <Field label="Biomass gained (kg)" type="number" inputMode="decimal" value={fc.gain} onChange={sfc('gain')} />
          </div>
          <Result label="FCR" value={show(fcr(fc.feed, fc.gain), 2)} unit="" />
        </Section>

        <Section title="Volumetric tank estimate" hint="Average sample count scaled up to the tank. An estimate, not a direct count.">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Avg count" type="number" inputMode="decimal" value={vt.mean} onChange={svt('mean')} />
            <Field label="Tank (L)" type="number" inputMode="decimal" value={vt.tank} onChange={svt('tank')} />
            <Field label="Sample (mL)" type="number" inputMode="decimal" value={vt.sample} onChange={svt('sample')} />
          </div>
          <Result label="Estimated total" value={show(volumetricTotal(vt.mean, vt.tank, vt.sample), 0)} unit="PL" />
        </Section>
      </div>
    </>
  )
}
