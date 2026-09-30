import { localeOf, t } from './i18n'

export const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : Math.round(n).toLocaleString('en-IN'))
/** 13820000 -> "1.38 crore", 450000 -> "4.5 lakh": how hatchery numbers are spoken in India. Smaller numbers stay as they are. */
export function words(n) {
  if (n == null || Number.isNaN(n)) return ''
  const round = (x) => String(Math.round(x * 100) / 100)
  if (n >= 1e7) return `${round(n / 1e7)} ${t('unit_crore')}`
  if (n >= 1e5) return `${round(n / 1e5)} ${t('unit_lakh')}`
  return ''
}

/** How steady the samples are, in plain words (cv = spread in percent). */
export function steadiness(cv) {
  if (cv <= 5) return { text: t('steady'), tone: 'teal' }
  if (cv <= 10) return { text: t('some_variation'), tone: 'amber' }
  return { text: t('varies_lot'), tone: 'amber' }
}

export const fmtDate = (iso) => new Date(iso).toLocaleDateString(localeOf(), { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' })

export function csv(batch, samples) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = samples.map((s) => [batch.code, s.timestamp, s.method, s.predicted ?? '', s.count, s.notes])
  return [['batch', 'timestamp', 'method', 'model_count', 'final_count', 'notes'].join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}

export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return } catch { /* cancelled */ } }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

// Customer documents (report, certificate, invoice) are always in English and English-format dates, whatever language the app is in.
export const docDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const docTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
export const docSteadiness = (cv) => (cv <= 5 ? { text: 'Steady', tone: 'teal' } : cv <= 10 ? { text: 'Some variation', tone: 'amber' } : { text: 'Varies a lot', tone: 'amber' })
