import { LANGS, getLang, t } from '../lib/i18n'
import { markEntered } from '../lib/entry'
import { cloudConfigured } from '../lib/cloud'
import Logo from '../components/Logo'
import { AppBadges } from '../components/Install'
import { PRICE_SETUP_INR, PRICE_MONTHLY_INR } from '../lib/pricing'
import { mailtoAccess } from '../lib/contact'

const scrollToApp = () => document.getElementById('get-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const go = (p) => { window.location.hash = p }
const start = () => go('/setup')   // straight into the 2-count trial; self-serve sign-up is not offered here (see lib/demo.js)

// A stylised tray with circled larvae, made in code so no customer photo is published. The marks are deterministic.
function marks() {
  let s = 11
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const out = []
  for (let i = 0; i < 190; i++) {
    const x = 30 + r() * 300, y = 20 + r() * 300
    const dx = x - 180, dy = y - 170
    if (Math.abs(dx) > 150 - Math.max(0, Math.abs(dy) - 115)) continue
    out.push({ x, y, a: Math.round(r() * 180), o: i % 27 === 0 })
  }
  return out
}
const MARKS = marks()

function Phone() {
  return (
    <div className="relative mx-auto w-[16.5rem] rounded-[2rem] bg-surface p-2 ring-1 ring-white/15" aria-hidden="true">
      <div className="overflow-hidden rounded-[1.5rem] bg-black">
        <div className="flex h-10 items-center justify-between px-3 text-white">
          <span className="text-lg leading-none">‹</span><span className="text-[0.75rem] font-semibold">{t('lp_ph_title')}</span><span className="w-4" />
        </div>
        <svg viewBox="0 0 360 340" className="block w-full">
          <defs><radialGradient id="lp-g" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#efe2cf" /><stop offset="1" stopColor="#cdb591" /></radialGradient></defs>
          <rect width="360" height="340" fill="#b39a76" />
          <path d="M60 8H300L352 58V284L300 334H60L8 284V58Z" fill="url(#lp-g)" />
          <path d="M60 8H300L352 58V284L300 334H60L8 284V58Z" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2.5" strokeDasharray="9 6" />
          {MARKS.map((m, i) => (
            <g key={i}>
              <path d={`M${m.x} ${m.y} l6 -1.6`} stroke="#6b4f33" strokeWidth="1.7" strokeLinecap="round" transform={`rotate(${m.a} ${m.x} ${m.y})`} />
              <circle cx={m.x} cy={m.y} r="6.5" fill="none" stroke={m.o ? '#e0a100' : '#e4572e'} strokeWidth="1.5" />
            </g>
          ))}
        </svg>
        <div className="-mt-2 rounded-t-xl bg-surface px-4 pb-4 pt-3">
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('final_count')}</div>
          <div className="font-display text-[2.5rem] font-medium leading-none tracking-[-0.04em] text-slate-900">1,708</div>
          <div className="mt-3 flex gap-2">
            <span className="flex h-9 flex-1 items-center justify-center rounded-lg bg-surface text-[0.6875rem] font-medium text-slate-700 ring-1 ring-white/15">{t('lp_ph_next')}</span>
            <span className="flex h-9 flex-[1.4] items-center justify-center rounded-lg bg-slate-900 text-[0.8125rem] font-semibold text-on-accent">{t('save')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURES = ['water', 'crowd', 'stage', 'docs', 'backup', 'lang']
const Tag = ({ children }) => (
  <span className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-slate-700"><span className="h-2 w-2 bg-aqua-400" />{children}</span>
)
const rule = 'border-t border-white/[0.09]'

export default function Landing({ store, entered, installed }) {
  const lang = getLang()
  // In a plain browser tab every call to action leads to installing the app, never straight into a count - that only
  // opens once the app itself is running (see App.jsx). Inside the installed app it behaves as it always has.
  const open = () => { if (!installed) { scrollToApp(); return } if (entered) go('/'); else start() }
  const btn = 'inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-[1.0625rem] font-medium'
  return (
    <div className="min-h-dvh text-slate-900" style={{ background: 'repeating-linear-gradient(135deg,#fff 0 7px,#f0f1f3 7px 8px)' }}>
      <div className="mx-auto max-w-5xl border-x border-white/[0.09] bg-surface">
        {/* top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-white/[0.09] bg-surface/95 px-4 backdrop-blur">
          <a href="#/welcome" className="flex items-center gap-2.5"><Logo size={30} /><span className="font-display text-[1.0625rem] font-semibold tracking-tight">ShrimpCount</span></a>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="lp-lang">{t('lang_label')}</label>
            <select id="lp-lang" value={lang} onChange={(e) => store.setSettings({ language: e.target.value })}
              className="min-h-11 max-w-[7.5rem] rounded-lg bg-surface px-2 text-[0.875rem] font-medium text-slate-800 ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-slate-900">
              {LANGS.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
            </select>
            {installed && !entered && <button onClick={() => go(cloudConfigured ? '/login' : '/setup')} className="hidden min-h-11 px-3 text-[0.9375rem] font-medium text-slate-700 sm:block">{t('lp_signin')}</button>}
            <button onClick={open} className="min-h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-[0.9375rem] font-medium text-on-accent active:bg-slate-700">{!installed ? t('lp_get_app_short') : entered ? t('lp_open') : t('lp_start_short')}</button>
          </div>
        </header>

        {/* hero */}
        <section className="px-5 pb-16 pt-14 text-center md:pt-20">
          <Tag>{t('lp_pill')}</Tag>
          <h1 className="font-display mx-auto mt-6 max-w-3xl text-[2.5rem] font-medium leading-[1.06] tracking-[-0.04em] md:text-[4rem]">{t('lp_h1')}</h1>
          <p className="mx-auto mt-6 max-w-xl text-[1.125rem] leading-relaxed text-slate-600">{t('lp_sub')}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={open} className={`${btn} bg-slate-900 text-on-accent active:bg-slate-700`}>{!installed ? t('lp_get_app') : entered ? t('lp_open') : t('lp_cta')}</button>
            {installed && !entered && cloudConfigured && <button onClick={() => go('/login')} className={`${btn} bg-surface text-slate-900 ring-1 ring-white/15 active:bg-slate-100`}>{t('lp_have')}</button>}
          </div>
          <p className="mt-4 text-[0.875rem] text-slate-500">{installed ? t('lp_note') : t('lp_note_install')}</p>
        </section>

        {/* get the app: a dedicated, store-badge-style section (our own design, no Play Store/App Store artwork) */}
        <section id="get-app" className={`${rule} scroll-mt-16 px-5 py-16 text-center`}>
          <Tag>{t('lp_app_kicker')}</Tag>
          <h2 className="font-display mx-auto mt-4 max-w-md text-[1.875rem] font-medium tracking-[-0.03em] md:text-[2.25rem]">{t('lp_app_h')}</h2>
          <p className="mx-auto mt-3 max-w-md text-[1rem] leading-relaxed text-slate-600">{t('lp_app_b')}</p>
          <AppBadges className="mt-7" />
          <p className="mt-4 text-[0.8125rem] text-slate-500">{t('lp_app_note')}</p>
        </section>

        {/* the product, framed */}
        <section className={`${rule} bg-slate-100 px-5 py-12`} style={{ backgroundImage: 'radial-gradient(#cfd3d8 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <Phone />
        </section>

        {/* trust strip: only things that are true */}
        <section className={`${rule} grid divide-white/[0.09] sm:grid-cols-3 sm:divide-x`}>
          {['lp_tr1', 'lp_tr2', 'lp_tr3'].map((k) => <div key={k} className="px-5 py-6 text-center text-[0.9375rem] font-medium text-slate-700"><Tag>{t(k)}</Tag></div>)}
        </section>

        {/* how it works */}
        <section className={`${rule} px-5 py-16`}>
          <h2 className="font-display text-[2rem] font-medium tracking-[-0.03em] md:text-[2.5rem]">{t('lp_how')}</h2>
          <ol className="mt-10 grid divide-white/[0.09] border border-white/[0.09] md:grid-cols-3 md:divide-x">
            {[1, 2, 3].map((n) => (
              <li key={n} className="border-b border-white/[0.09] p-6 last:border-b-0 md:border-b-0">
                <span className="font-display text-[0.9375rem] font-medium text-slate-500">0{n}</span>
                <h3 className="font-display mt-6 text-[1.375rem] font-medium tracking-[-0.02em]">{t(`lp_s${n}_h`)}</h3>
                <p className="mt-2 text-[1rem] leading-relaxed text-slate-600">{t(`lp_s${n}_b`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* features */}
        <section className={`${rule} px-5 py-16`}>
          <h2 className="font-display text-[2rem] font-medium tracking-[-0.03em] md:text-[2.5rem]">{t('lp_feat')}</h2>
          <div className="mt-10 grid border-l border-t border-white/[0.09] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((k) => (
              <div key={k} className="border-b border-r border-white/[0.09] p-6">
                <span className="block h-2 w-2 bg-aqua-400" />
                <h3 className="font-display mt-5 text-[1.1875rem] font-medium tracking-[-0.01em]">{t(`lp_f_${k}_h`)}</h3>
                <p className="mt-2 text-[1rem] leading-relaxed text-slate-600">{t(`lp_f_${k}_b`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* pricing: one plan, one price, no top-up meter */}
        <section className={`${rule} px-5 py-16 text-center`}>
          <Tag>{t('lp_price_kicker')}</Tag>
          <h2 className="font-display mx-auto mt-4 max-w-md text-[1.875rem] font-medium tracking-[-0.03em] md:text-[2.25rem]">{t('lp_price_h')}</h2>
          <p className="mx-auto mt-3 max-w-md text-[1rem] leading-relaxed text-slate-600">{t('lp_price_b')}</p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/[0.09] p-8">
            <div className="flex items-end justify-center gap-1">
              <span className="font-display text-[1.25rem] font-medium text-slate-500">₹</span>
              <span className="font-display text-[3.25rem] font-medium leading-none tracking-[-0.03em] text-slate-900">{PRICE_SETUP_INR.toLocaleString('en-IN')}</span>
            </div>
            <div className="mt-1 text-[0.9375rem] font-medium text-slate-500">{t('lp_price_setup')}</div>
            <div className="mt-4 rounded-xl bg-slate-100 py-2.5 text-[0.875rem] font-medium text-slate-700">
              {t('lp_price_then', { n: PRICE_MONTHLY_INR.toLocaleString('en-IN') })}
            </div>
            <ul className="mt-6 space-y-2.5 text-left text-[0.9375rem] text-slate-700">
              {['lp_price_f1', 'lp_price_f2', 'lp_price_f3', 'lp_price_f4'].map((k) => (
                <li key={k} className="flex items-start gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-aqua-400" />{t(k)}</li>
              ))}
            </ul>
            <a href={mailtoAccess()} className="mt-7 flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-[1.0625rem] font-medium text-on-accent active:bg-slate-700">{t('lp_price_cta')}</a>
          </div>
          <p className="mt-5 text-[0.8125rem] text-slate-500">{t('lp_price_note')}</p>
        </section>

        {/* honest accuracy */}
        <section className={`${rule} bg-slate-900 px-5 py-16 text-on-accent`}>
          <Tag><span className="text-on-accent/80">{t('lp_acc_h')}</span></Tag>
          <p className="font-display mt-5 max-w-3xl text-[1.625rem] font-medium leading-snug tracking-[-0.02em] md:text-[2rem]">{t('lp_acc_b')}</p>
          <p className="mt-5 max-w-3xl text-[0.9375rem] leading-relaxed text-on-accent/60">{t('lp_acc_c')}</p>
        </section>

        {/* faq */}
        <section className={`${rule} px-5 py-16`}>
          <h2 className="font-display text-[2rem] font-medium tracking-[-0.03em]">{t('lp_faq')}</h2>
          <div className="mt-8 divide-y divide-white/[0.09] border-y border-white/[0.09]">
            {[1, 2, 3, 4].map((n) => (
              <details key={n} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 text-[1.0625rem] font-medium">{t(`lp_q${n}`)}<span className="text-xl text-slate-400 transition group-open:rotate-45">+</span></summary>
                <p className="pb-5 text-[1rem] leading-relaxed text-slate-600">{t(`lp_a${n}`)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* final call */}
        <section className={`${rule} px-5 py-16 text-center`}>
          <h2 className="font-display mx-auto max-w-2xl text-[2rem] font-medium tracking-[-0.03em] md:text-[2.5rem]">{t('lp_final')}</h2>
          <button onClick={open} className={`${btn} mt-8 bg-slate-900 text-on-accent active:bg-slate-700`}>{!installed ? t('lp_get_app') : entered ? t('lp_open') : t('lp_cta')}</button>
          {installed && !entered && <div><button onClick={() => { markEntered(); go('/') }} className="mt-4 min-h-11 text-[0.9375rem] font-medium text-slate-600 underline">{t('au_local')}</button></div>}
        </section>
        <footer className={`${rule} px-5 py-8 text-center text-[0.8125rem] text-slate-500`}>{t('lp_foot')}</footer>
      </div>
    </div>
  )
}
