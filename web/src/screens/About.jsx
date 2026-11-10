import { Card, PageHeader } from '../components/ui'
import { CONTACT_EMAIL, CONTACT_PHONE } from '../lib/contact'
import { t } from '../lib/i18n'

const btn = 'flex min-h-14 w-full items-center justify-center rounded-2xl px-5 py-3 text-center text-[1.0625rem] font-semibold leading-snug min-w-0 break-all'

const Block = ({ title, children }) => (
  <Card className="p-5">
    <h2 className="font-display text-[1.0625rem] font-medium tracking-[-0.01em] text-slate-900">{title}</h2>
    <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-600">{children}</p>
  </Card>
)

// What the app does with a hatchery's data, how far to trust the count, and how to get help. Plain statements only:
// each one is true of the code as it stands (records in the phone's browser; backup to Supabase only after sign-in;
// the counting API stores nothing). Change the text if any of that changes.
export default function About({ go }) {
  const subject = encodeURIComponent('ShrimpCount support')
  const wa = CONTACT_PHONE ? `https://wa.me/${CONTACT_PHONE}?text=${subject}` : null
  return (
    <>
      <PageHeader title={t('ab_title')} sub={t('ab_version')} onBack={() => go('/more')} />
      <div className="space-y-3">
        <Block title={t('ab_h_acc')}>{t('ab_acc')}</Block>
        <Block title={t('ab_h_records')}>{t('ab_records')}</Block>
        <Block title={t('ab_h_photo')}>{t('ab_photo')}</Block>
        <Block title={t('ab_h_help')}>{t('ab_help')}</Block>
        <div className="space-y-3 pt-1">
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className={`${btn} bg-slate-900 text-on-accent active:bg-slate-700`}>{t('ac_email', { email: CONTACT_EMAIL })}</a>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className={`${btn} bg-surface text-slate-900 ring-1 ring-white/[0.12] active:bg-slate-100`}>{t('ac_whatsapp')}</a>}
        </div>
      </div>
    </>
  )
}
