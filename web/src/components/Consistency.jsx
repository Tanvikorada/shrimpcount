import { t } from '../lib/i18n'
import { Card } from './ui'

/** Each sample as a dot around the batch average, with a ±5% band. Shows repeatability at a glance. */
export default function Consistency({ counts }) {
  if (counts.length < 2) return null
  const mean = counts.reduce((a, c) => a + c, 0) / counts.length
  if (!mean) return null
  const dev = counts.map((c) => ((c - mean) / mean) * 100)
  const maxDev = Math.max(5, ...dev.map(Math.abs))
  const H = 120, mid = H / 2, scale = (mid - 10) / maxDev
  const W = 320, step = W / counts.length
  return (
    <Card className="mt-3 p-4">
      <div className="text-[0.9375rem] font-semibold text-slate-900">{t('cons_title')}</div>
      <div className="mt-0.5 text-xs text-slate-500">{t('cons_body', { n: counts.length })}</div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="mt-3 w-full" role="img"
        aria-label={`Sample counts relative to the average of ${Math.round(mean)}: ${counts.join(', ')}`}>
        <rect x="0" y={mid - 5 * scale} width={W} height={10 * scale} rx="8" fill="var(--color-chart-band)" />
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--color-chart)" strokeWidth="2" strokeDasharray="5 4" />
        <text x={W - 4} y={mid - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--color-chart)">avg {Math.round(mean)}</text>
        {counts.map((c, i) => (
          <g key={i}>
            <circle cx={step * i + step / 2} cy={mid - dev[i] * scale} r="6" fill={Math.abs(dev[i]) > 5 ? '#c2410c' : 'var(--color-chart)'} stroke="var(--color-surface)" strokeWidth="2">
              <title>{`${c} (${dev[i] >= 0 ? '+' : ''}${dev[i].toFixed(1)}%)`}</title>
            </circle>
            <text x={step * i + step / 2} y={H + 14} textAnchor="middle" fontSize="11" fill="var(--color-slate-500)">{c}</text>
          </g>
        ))}
      </svg>
    </Card>
  )
}
