import { LANGS, getLang, t } from '../lib/i18n'
import { tap } from '../lib/haptics'

/**
 * Choose the app language. Each language is written in its own script so anyone can find theirs.
 * On first launch there is no close button: the person picks a language before anything else.
 */
export default function LanguageSheet({ onPick, onClose }) {
  const current = getLang()
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/45 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Language">
      <div className="page-in w-full max-w-md rounded-t-2xl bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-center text-[1.375rem] font-bold tracking-tight text-slate-900">{t('lang_title')}</h2>
        {!onClose && <p className="mt-1 text-center text-[0.9375rem] text-slate-500">Choose your language · భాషను ఎంచుకోండి · भाषा चुनें · மொழியைத் தேர்ந்தெடுக்கவும்</p>}
        <div className="mt-5 grid gap-3">
          {LANGS.map(([code, native]) => (
            <button key={code} onClick={() => { tap(); onPick(code) }} aria-pressed={current === code}
              className={`flex min-h-[4.25rem] items-center justify-between rounded-2xl px-5 text-left ring-1 active:scale-[0.99] ${current === code ? 'bg-teal-50 ring-2 ring-teal-600' : 'bg-surface ring-slate-200'}`}>
              <span className="text-[1.5rem] font-semibold text-slate-900" lang={code}>{native}</span>
              <span className="text-[0.9375rem] text-slate-500">{{ en: 'English', te: 'Telugu', hi: 'Hindi', ta: 'Tamil' }[code]}</span>
            </button>
          ))}
        </div>
        {onClose && <button onClick={onClose} className="mt-4 min-h-14 w-full rounded-2xl text-[1.0625rem] font-semibold text-slate-600 active:bg-slate-100">{t('cancel')}</button>}
      </div>
    </div>
  )
}
