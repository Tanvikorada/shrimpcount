import { tap } from '../lib/haptics'
import { t } from '../lib/i18n'

// Soft white cards on a light grey page, large rounded corners, no hard borders (the look of the phone's own apps).
export const Card = ({ className = '', ...p }) => (
  <div className={`rounded-3xl bg-surface ring-1 ring-white/[0.09] ${className}`} {...p} />
)

export const Stat = ({ label, value, sub }) => (
  <Card className="min-w-0 p-4">
    <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
    <div className={`font-display mt-1 break-words font-bold tabular-nums tracking-tight text-slate-900 ${String(value).length > 7 ? 'text-[1.125rem] leading-snug' : 'text-3xl'}`}>{value}</div>
    {sub && <div className="mt-0.5 text-[0.8125rem] leading-snug text-slate-500">{sub}</div>}
  </Card>
)

export const Field = ({ label, hint, ...p }) => (
  <label className="block">
    <span className="text-[0.9375rem] font-semibold text-slate-800">{label}</span>
    <input {...p} className="mt-1.5 min-h-14 w-full rounded-2xl bg-surface px-4 text-base text-slate-900 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600" />
    {hint && <span className="mt-1 block text-[0.8125rem] text-slate-500">{hint}</span>}
  </label>
)

const variants = {
  primary: 'bg-teal-700 text-on-accent active:bg-teal-900',
  dark: 'bg-slate-900 text-on-accent active:bg-slate-800',
  ghost: 'bg-surface text-slate-900 ring-1 ring-white/15 active:bg-slate-100',
  danger: 'bg-surface text-red-700 ring-1 ring-red-200 active:bg-red-50',
}
export const Button = ({ variant = 'primary', className = '', onClick, ...p }) => (
  <button {...p} onClick={onClick && ((e) => { tap(); onClick(e) })}
    className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold disabled:opacity-50 ${variants[variant]} ${className}`} />
)

export const Empty = ({ title, body, action }) => (
  <Card className="p-8 text-center">
    <div className="text-lg font-semibold text-slate-900">{title}</div>
    <p className="mx-auto mt-1 max-w-xs text-[0.9375rem] leading-snug text-slate-500">{body}</p>
    {action && <div className="mt-5">{action}</div>}
  </Card>
)

export const Badge = ({ tone = 'slate', children }) => {
  const tones = { slate: 'bg-slate-100 text-slate-700', teal: 'bg-teal-50 text-teal-800', amber: 'bg-amber-100 text-amber-900' }
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

// Large bold title like the phone's own apps. A back button sits above it with the word "Back", which is clearer than an arrow alone.
export const PageHeader = ({ title, sub, onBack, right }) => (
  <div className="mb-6">
    {onBack && (
      <button onClick={() => { tap(); onBack() }} aria-label="Back" className="-ml-2 mb-2 flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-[0.9375rem] font-medium text-slate-600 active:bg-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>{t('back')}
      </button>
    )}
    <div className="flex items-end justify-between gap-3 border-b border-white/[0.09] pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-[1.875rem] font-medium leading-[1.1] tracking-[-0.03em] text-slate-900">{title}</h1>
        {sub && <p className="mt-1 text-[0.9375rem] text-slate-500">{sub}</p>}
      </div>
      {right && <div className="shrink-0 pb-1">{right}</div>}
    </div>
  </div>
)

/** A small grey label above a group of rows, like the phone's own settings. */
export const Label = ({ children, className = '' }) => (
  <div className={`mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500 ${className}`}>{children}</div>
)
