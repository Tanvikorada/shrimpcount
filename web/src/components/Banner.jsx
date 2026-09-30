// A calm, stacked notice: icon and words on top, the action underneath at full width. Wraps cleanly at any text size or language.
export default function Banner({ icon, title, body, action, onAction, onClose }) {
  return (
    <div className="mb-4 rounded-3xl bg-surface p-4 ring-1 ring-white/[0.09]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-on-accent">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[1rem] font-bold leading-tight text-slate-900">{title}</div>
          <div className="mt-0.5 text-[0.875rem] leading-snug text-slate-500">{body}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-xl text-slate-400">×</button>
      </div>
      <button onClick={onAction} className="mt-3 min-h-12 w-full rounded-xl bg-teal-700 px-4 text-[0.9375rem] font-semibold text-on-accent active:bg-teal-900">{action}</button>
    </div>
  )
}
