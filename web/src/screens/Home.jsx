import { useState } from 'react'
import { Card, Empty, Button, Badge } from '../components/ui'
import { batchStats } from '../lib/store'
import { attention } from '../lib/attention'
import { flushQueue } from '../lib/sync'
import { fmt, fmtTime, steadiness } from '../lib/format'
import { TEXT_SIZES, tap } from '../lib/haptics'
import { LANGS, getLang, localeOf, t } from '../lib/i18n'
import { Plus, Camera, Box, Drop, Tasks as TasksIcon } from '../components/icons'
import { InstallCard } from '../components/Install'
import Logo from '../components/Logo'
import { BackupBanner, SyncChip } from '../components/CloudStatus'
import { demoUsesLeft, isDemoAccount, goCount } from '../lib/demo'
import { useCloud } from '../lib/cloud'

const KIND = {
  stock: { Icon: Box, tone: 'bg-amber-100 text-amber-900' },
  water: { Icon: Drop, tone: 'bg-amber-100 text-amber-900' },
  task: { Icon: TasksIcon, tone: 'bg-red-100 text-red-900' },
}

const Section = ({ title, action, children }) => (
  <section className="mt-9">
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[1.1875rem] font-bold tracking-[-0.02em] text-slate-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

export default function Home({ store, go, openLang }) {
  const { batches, samples, settings } = store
  const cloud = useCloud()
  const demoLeft = isDemoAccount(cloud) ? demoUsesLeft(store) : null
  const today = new Date().toDateString()
  const todays = samples.filter((s) => new Date(s.timestamp).toDateString() === today)
  const active = batches.filter((b) => b.status === 'active')
  const [picked, setPicked] = useState('')
  const target = active.find((b) => b.id === picked) || active[0]
  const alerts = settings.showExtras ? attention(store) : []
  const todayTotal = todays.reduce((n, x) => n + (Number(x.count) || 0), 0)
  const waiting = samples.filter((s) => s.aiPending).length
  const size = settings.textSize || 'large'
  const nextSize = () => {
    const i = TEXT_SIZES.findIndex(([k]) => k === size)
    store.setSettings({ textSize: TEXT_SIZES[(i + 1) % TEXT_SIZES.length][0] })
  }
  const chip = 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-surface px-3.5 text-slate-800 ring-1 ring-white/10 active:bg-slate-100'

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={40} className="shrink-0 drop-shadow-sm" />
          {settings.hatchery && <span className="truncate text-[1.0625rem] font-semibold tracking-tight text-slate-500">ShrimpCount</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => { tap(); openLang() }} className={chip} aria-label={t('lang_label')}>
            <span className="text-[0.9375rem] font-semibold" lang={getLang()}>{LANGS.find(([k]) => k === getLang())?.[1]}</span>
          </button>
          <button onClick={() => { tap(); nextSize() }} aria-label={t('text_size')} className={chip}>
            <span className="text-[0.875rem] font-medium">A</span><span className="text-[1.25rem] font-bold leading-none">A</span>
          </button>
        </div>
      </div>
      <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-slate-900">{settings.hatchery || 'ShrimpCount'}</h1>
      <p className="mb-6 mt-1 text-[0.9375rem] font-medium text-slate-500">{new Date().toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <SyncChip />
      {waiting > 0 && (
        <button onClick={() => flushQueue(store)} className="mb-4 block w-full text-left">
          <Badge tone="amber">{t('home_waiting', { n: waiting })}</Badge>
        </button>
      )}

      {/* the one thing to do: today's total as a readout, then a single ink button */}
      <div className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.09]">
        {target ? (
          <>
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><span className="h-2 w-2 bg-aqua-400" />{t('home_today')}</div>
            <div className="font-display mt-3 text-[3.5rem] font-medium leading-none tabular-nums tracking-[-0.04em] text-slate-900">{todays.length ? fmt(todayTotal) : '0'}</div>
            <div className="mt-2 text-[0.9375rem] text-slate-500">{todays.length === 0 ? t('home_no_counts_today') : t('home_counts_today', { n: todays.length })}</div>
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <label className="block">
                <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('home_counting_for')}</span>
                <select value={target.id} onChange={(e) => setPicked(e.target.value)}
                  className="min-h-14 w-full rounded-2xl bg-slate-100 px-4 text-[1.0625rem] font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-900">
                  {active.map((b) => <option key={b.id} value={b.id}>{b.code}{b.tank ? ` · ${b.tank}` : ''}{b.plStage ? ` · ${b.plStage}` : ''}</option>)}
                </select>
              </label>
              <button onClick={() => { tap(14); goCount(store, cloud, go, target.id) }}
                className="mt-3 flex min-h-[4.25rem] w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-3 text-[1.125rem] font-semibold text-on-accent active:bg-slate-700">
                <Camera width={26} height={26} />{t('home_count_btn')}
              </button>
              <p className="mt-3 text-center text-[0.8125rem] text-slate-500">{t('home_hint')}</p>
              {demoLeft != null && (
                <p className={`mt-1 text-center text-[0.8125rem] font-semibold ${demoLeft > 0 ? 'text-slate-500' : 'text-amber-700'}`}>
                  {demoLeft > 0 ? t('demo_left', { n: demoLeft }) : t('demo_used')}
                </p>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><span className="h-2 w-2 bg-aqua-400" />{t('home_start')}</div>
            <p className="font-display mt-3 text-[1.5rem] font-medium leading-tight tracking-[-0.02em] text-slate-900">{t('home_start_body')}</p>
            <button onClick={() => { tap(14); go('/batches/new') }} className="mt-5 flex min-h-[4.25rem] w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-3 text-[1.125rem] font-semibold text-on-accent active:bg-slate-700">
              <Plus width={24} height={24} />{t('home_first_batch')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 empty:hidden">
        <BackupBanner go={go} />
        <InstallCard />
      </div>

      {alerts.length > 0 && (
        <Section title="Needs attention">
          <Card className="divide-y divide-slate-100 px-4">
            {alerts.slice(0, 5).map((a, i) => {
              const { Icon, tone } = KIND[a.kind]
              return (
                <button key={i} onClick={() => go(a.to)} className="flex min-h-[4rem] w-full items-center gap-3 py-3 text-left">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon width={22} height={22} /></span>
                  <span className="flex-1"><span className="block text-[1rem] font-semibold text-slate-900">{a.title}</span><span className="block text-[0.8125rem] text-slate-500">{a.sub}</span></span>
                  <span className="text-xl text-slate-300">›</span>
                </button>
              )
            })}
          </Card>
        </Section>
      )}

      <Section title={t('home_today')} action={samples.length > 0 && <button onClick={() => go('/counts')} className="min-h-12 pl-3 text-[0.9375rem] font-semibold text-teal-700">{t('all_counts')}</button>}>
        {samples.length === 0 ? (
          <Card className="p-5 text-[0.9375rem] leading-snug text-slate-500">{t('home_nothing')}</Card>
        ) : (
          <Card className="divide-y divide-slate-100 px-4">
            <div className="py-3 text-[0.9375rem] font-medium text-slate-500">{todays.length === 0 ? t('home_no_counts_today') : t('home_counts_today', { n: todays.length })}</div>
            {(todays.length ? todays : samples).slice(0, 5).map((s) => {
              const b = batches.find((x) => x.id === s.batchId)
              return (
                <div key={s.id} className="flex min-h-[4.25rem] items-center gap-3 py-2.5">
                  {s.thumb ? <img src={s.thumb} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[1rem] font-semibold text-slate-900">{b?.code || '—'}</div>
                    <div className="text-[0.8125rem] text-slate-500">{fmtTime(s.timestamp)}{s.species ? ` · ${s.species}` : ''}</div>
                  </div>
                  <div className="text-[1.375rem] font-bold tabular-nums tracking-tight text-slate-900">{fmt(s.count)}</div>
                </div>
              )
            })}
          </Card>
        )}
      </Section>

      <Section title={t('home_batches')} action={<button onClick={() => go('/batches')} className="min-h-12 pl-3 text-[0.9375rem] font-semibold text-teal-700">{t('see_all')}</button>}>
        {active.length === 0 ? (
          <Empty title={t('home_no_active')} body={t('home_no_active_body')}
            action={<Button onClick={() => go('/batches/new')}><Plus width={18} />{t('home_new_batch')}</Button>} />
        ) : (
          <div className="space-y-3">
            {active.slice(0, 4).map((b) => {
              const st = batchStats(b, samples)
              return (
                <Card key={b.id}>
                  <button className="flex min-h-[4.75rem] w-full items-center justify-between gap-3 p-4 text-left" onClick={() => go(`/batch/${b.id}`)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-[1.0625rem] font-bold text-slate-900">{b.code}</span>{b.plStage && <Badge tone="teal">{b.plStage}</Badge>}</div>
                      <div className="mt-0.5 text-[0.8125rem] text-slate-500">{b.tank ? `${t('tank_n', { t: b.tank })} · ` : ''}{st.n ? t('counts_n', { n: st.n }) : t('home_no_samples')}{st.n > 1 ? ` · ${steadiness(st.cv).text}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[1.5rem] font-bold leading-none tabular-nums tracking-tight text-slate-900">{st.n ? fmt(st.mean) : '–'}</div>
                      <div className="mt-1 text-xs text-slate-500">{t('home_average')}</div>
                    </div>
                  </button>
                </Card>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}
