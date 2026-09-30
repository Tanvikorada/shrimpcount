import { useEffect, useState } from 'react'
import Logo from './Logo'
import { docDate } from '../lib/format'
import { evidenceGet } from '../lib/evidence'

/** Header shared by the count report, the delivery certificate and the invoice: logo, document type, hatchery, number, date. */
export function DocHeader({ label, name, number, date = new Date() }) {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-teal-700 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Logo size={52} className="shrink-0" />
        <div className="min-w-0">
          <div className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-teal-700">{label}</div>
          <h2 className="text-[1.375rem] font-bold leading-tight tracking-tight text-slate-900">{name}</h2>
        </div>
      </div>
      <div className="flex shrink-0 items-baseline justify-between gap-3 text-[0.8125rem] text-slate-500 sm:block sm:text-right">
        <div className="font-mono text-[0.75rem] font-semibold text-slate-800">{number}</div>
        <div>{docDate(date.toISOString())}</div>
      </div>
    </header>
  )
}

export const DocFooter = ({ number }) => (
  <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-3 text-[0.75rem] text-slate-400">
    <span>Counted with ShrimpCount</span><span className="font-mono">{number}</span>
  </footer>
)

/** Signature lines. Each item: [caption, optional name printed under the line]. */
export const SignBlock = ({ items }) => (
  <div className={`mt-8 grid gap-8 text-[0.8125rem] text-slate-500 print:break-inside-avoid ${items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
    {items.map(([caption, who]) => (
      <div key={caption}><div className="h-12 border-b border-slate-400" />{caption}{who ? `: ${who}` : ''}</div>
    ))}
  </div>
)

export const DocRow = ({ k, children, strong }) => (
  <div><dt className="text-xs text-slate-500">{k}</dt><dd className={strong ? 'text-[1.125rem] font-bold text-slate-900' : 'font-semibold text-slate-900'}>{children}</dd></div>
)

/** The marked photos kept with the most recent counts of a batch (newest first), as object URLs that are released on leaving. */
export function useEvidence(samples, max = 4) {
  const [photos, setPhotos] = useState([])
  const key = samples.slice(0, max).map((s) => s.id).join(',')
  useEffect(() => {
    let dead = false
    const urls = []
    ;(async () => {
      const out = []
      for (const s of samples.slice(0, max)) {
        const blob = await evidenceGet(s.id)
        if (blob) { const url = URL.createObjectURL(blob); urls.push(url); out.push({ id: s.id, url, count: s.count, when: s.timestamp }) }
      }
      if (!dead) setPhotos(out)
    })()
    return () => { dead = true; urls.forEach((u) => URL.revokeObjectURL(u)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, max])
  return photos
}
