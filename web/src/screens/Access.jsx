import { PageHeader } from '../components/ui'
import { CONTACT_EMAIL, mailtoAccess, whatsappAccess } from '../lib/contact'
import { demoUsesLeft, DEMO_LIMIT } from '../lib/demo'
import { t } from '../lib/i18n'
import Logo from '../components/Logo'

const primary = 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-center text-[1.0625rem] font-semibold leading-snug text-on-accent active:bg-slate-700 min-w-0 break-all'
const ghost = 'flex min-h-14 w-full items-center justify-center rounded-2xl bg-surface px-5 py-3 text-center text-[1.0625rem] font-semibold leading-snug text-slate-900 ring-1 ring-white/[0.12] active:bg-slate-100 min-w-0 break-all'

// Shown once the free trial (DEMO_LIMIT counts, no account) is used up. This phone's own saved counts decide that, so
// it is a soft limit: it does not check anything on a server. Its job is to turn "used up the trial" into a lead, not to
// enforce a hard paywall.
export default function Access({ store, go }) {
  const left = demoUsesLeft(store)
  const wa = whatsappAccess(store.settings.hatchery)
  return (
    <>
      <PageHeader title={t('ac_title')} onBack={() => go('/')} />
      <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-white/[0.09]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center"><Logo size={56} /></div>
        <h2 className="font-display mt-4 text-[1.375rem] font-medium tracking-[-0.02em] text-slate-900">
          {left > 0 ? t('ac_left', { n: left }) : t('ac_used')}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-600">{t('ac_body')}</p>
        <div className="mt-6 space-y-3">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className={primary}>{t('ac_whatsapp')}</a>}
          <a href={mailtoAccess(store.settings.hatchery)} className={wa ? ghost : primary}>{t('ac_email', { email: CONTACT_EMAIL })}</a>
        </div>
        <button onClick={() => go('/login')} className="mt-5 min-h-11 text-[0.9375rem] font-medium text-slate-600 underline">{t('ac_have')}</button>
      </div>
    </>
  )
}
