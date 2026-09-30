import { useState } from 'react'
import { cloudConfigured, syncNow, useCloud } from '../lib/cloud'
import { tap } from '../lib/haptics'
import { t } from '../lib/i18n'
import Banner from './Banner'

const HIDE_KEY = 'shrimpcount.backup-hidden-until'

/** "3 min ago" in the person's language. */
export function ago(iso) {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return t('acc_just_now')
  if (m < 60) return t('acc_min_ago', { n: m })
  if (m < 60 * 24) return t('acc_h_ago', { n: Math.round(m / 60) })
  return t('acc_d_ago', { n: Math.round(m / 1440) })
}

export function statusText(c) {
  if (c.status === 'syncing') return t('acc_syncing')
  if (c.status === 'offline') return t('acc_wait')
  if (c.status === 'error') return t('acc_problem', { msg: c.error })
  return c.lastSync ? t('acc_ok', { when: ago(c.lastSync) }) : t('acc_never')
}

const Cloud = ({ className = '' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 .5 8.5z" />
  </svg>
)

/** A small line on Home: how recent the last backup is. Tapping it backs up now. Nothing shows when the cloud is off. */
export function SyncChip() {
  const c = useCloud()
  if (!cloudConfigured || !c.user || !c.hatchery) return null
  const bad = c.status === 'error' || c.status === 'offline'
  return (
    <button onClick={() => { tap(); syncNow() }} className={`mb-3 flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[0.8125rem] font-medium ${bad ? 'bg-amber-100 text-amber-900' : 'bg-good-100 text-teal-900'}`}>
      <Cloud className={c.status === 'syncing' ? 'animate-pulse' : ''} />
      <span className="truncate">{c.status === 'ok' || c.status === 'idle' ? statusText(c) : c.status === 'syncing' ? t('acc_syncing') : t('acc_wait')}</span>
    </button>
  )
}

/** Shown on Home until the person has an account: the records are only on this phone. Comes back after three days if closed. */
export function BackupBanner({ go }) {
  const c = useCloud()
  const [hidden, setHidden] = useState(() => { try { return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now() } catch { return false } })
  if (!cloudConfigured || !c.ready || c.user || hidden) return null
  const close = () => { try { localStorage.setItem(HIDE_KEY, String(Date.now() + 3 * 86400000)) } catch { /* ignore */ } setHidden(true) }
  return (
    <Banner icon={<Cloud />} title={t('acc_banner_title')} body={t('acc_banner_body')} action={t('acc_banner_btn')} onAction={() => { tap(14); go('/account') }} onClose={close} />
  )
}
