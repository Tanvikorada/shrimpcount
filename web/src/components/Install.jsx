import { useState } from 'react'
import { isIos, promptInstall, useInstall } from '../lib/install'
import { tap } from '../lib/haptics'
import { t } from '../lib/i18n'
import Banner from './Banner'

const HIDE_KEY = 'shrimpcount.install-hidden-until'
const DAY = 86400000

function usePress() {
  const { installed, canPrompt } = useInstall()
  const [help, setHelp] = useState(false)
  const press = async () => {
    tap(14)
    const r = await promptInstall()
    if (r === 'manual') setHelp(true)
  }
  return { installed, canPrompt, help, setHelp, press }
}

// The steps for browsers that cannot open an install dialog themselves.
function Help({ onClose }) {
  const ios = isIos()
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/45 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="page-in w-full max-w-md rounded-t-2xl bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-center text-[1.375rem] font-bold tracking-tight text-slate-900">{t('install_app')}</h2>
        <ol className="mt-4 space-y-3 text-[1rem] leading-snug text-slate-700">
          <li className={`rounded-2xl p-4 ${ios ? 'bg-teal-50 ring-2 ring-teal-600' : 'bg-slate-100'}`}>{t('install_ios')}</li>
          <li className={`rounded-2xl p-4 ${!ios ? 'bg-teal-50 ring-2 ring-teal-600' : 'bg-slate-100'}`}>{t('install_android')}</li>
        </ol>
        <p className="mt-3 text-center text-[0.8125rem] text-slate-500">{t('install_other')}</p>
        <button onClick={onClose} className="mt-4 min-h-14 w-full rounded-2xl bg-teal-700 text-[1.0625rem] font-semibold text-on-accent active:bg-teal-900">{t('install_close')}</button>
      </div>
    </div>
  )
}

const Icon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
  </svg>
)

/** Card at the top of Home. It comes back after three days if it was closed, and never shows once the app is installed. */
export function InstallCard() {
  const { installed, help, setHelp, press } = usePress()
  const [hidden, setHidden] = useState(() => {
    try { return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now() } catch { return false }
  })
  if (installed || hidden) return null
  const close = () => { try { localStorage.setItem(HIDE_KEY, String(Date.now() + 3 * DAY)) } catch { /* ignore */ } setHidden(true) }
  return (
    <>
      <Banner icon={<Icon />} title={t('install_app')} body={t('install_sub')} action={t('install_btn')} onAction={press} onClose={close} />
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  )
}

/** A row that is always there (More, Settings) until the app is installed. */
export function InstallRow() {
  const { installed, help, setHelp, press } = usePress()
  return (
    <>
      <button onClick={installed ? undefined : press} disabled={installed}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left ring-1 ring-white/[0.09] disabled:opacity-80">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-on-accent ${installed ? 'bg-good-500' : 'bg-slate-900'}`}>
          {installed ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg> : <Icon />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900">{installed ? t('install_installed') : t('install_app')}</span>
          {!installed && <span className="block text-sm text-slate-500">{t('install_sub')}</span>}
        </span>
      </button>
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  )
}

/** A plain button for the landing page: opens Android's install dialog, or shows the steps on iPhone. Hidden once installed. */
export function InstallButton({ className = '' }) {
  const { installed, help, setHelp, press } = usePress()
  if (installed) return null
  return (
    <>
      <button onClick={press} className={className}>{t('install_btn')} · {t('install_app')}</button>
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  )
}

const AndroidGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.2 8.6h11.6v8.1a1 1 0 0 1-1 1h-.6v2.3a1.3 1.3 0 0 1-2.6 0v-2.3h-3v2.3a1.3 1.3 0 0 1-2.6 0v-2.3h-.6a1 1 0 0 1-1-1zM5 9.4a1.1 1.1 0 0 1 2.2 0v5.6a1.1 1.1 0 0 1-2.2 0zm11.8 0a1.1 1.1 0 0 1 2.2 0v5.6a1.1 1.1 0 0 1-2.2 0zM8.6 3.9l-.9-1.5a.4.4 0 1 1 .7-.4l.9 1.6a5.6 5.6 0 0 1 4.4 0l.9-1.6a.4.4 0 1 1 .7.4l-.9 1.5a4.9 4.9 0 0 1 2.3 3.9H6.3a4.9 4.9 0 0 1 2.3-3.9zM9.4 6a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2zm5.2 0a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z" />
  </svg>
)
const AppleGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.4c0-2.6 2.1-3.8 2.2-3.9-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5.6-.9.9-1.5 1.4-2.6-3.5-1.3-3.1-3.5-3.1-4.1zM13.9 4.9c.6-.8 1.1-1.9 1-3-1 0-2.2.6-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.5z" />
  </svg>
)

/** A store-style badge - our own design (no Play Store / App Store artwork). "Android" opens the browser's own
 * install dialog when it can; either badge falls back to the on-screen steps. Hidden once installed. */
export function AppBadges({ className = '' }) {
  const { installed, help, setHelp, press } = usePress()
  if (installed) return null
  const badge = (Glyph, kicker, name) => (
    <button onClick={press} className="flex min-h-14 items-center gap-2.5 rounded-xl bg-slate-900 px-4 text-on-accent active:bg-slate-700">
      <Glyph />
      <span className="text-left leading-tight">
        <span className="block text-[0.625rem] font-medium uppercase tracking-[0.08em] text-on-accent/65">{kicker}</span>
        <span className="block text-[1.0625rem] font-medium tracking-[-0.01em]">{name}</span>
      </span>
    </button>
  )
  return (
    <>
      <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
        {badge(AndroidGlyph, t('install_get_on'), 'Android')}
        {badge(AppleGlyph, t('install_get_on'), 'iPhone')}
      </div>
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  )
}
