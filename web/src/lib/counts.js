// The count history: filter saved counts and export them. Pure, so it can be tested with node.

export const SPECIES = ['Vannamei', 'Monodon', 'Other']

/** Counts saved between two dates (inclusive, YYYY-MM-DD; either may be empty), optionally one species and/or one batch. */
export function filterCounts(samples, { from = '', to = '', species = '', batchId = '' } = {}) {
  const lo = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity
  const hi = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity
  return samples
    .filter((s) => {
      const t = new Date(s.timestamp).getTime()
      return t >= lo && t <= hi && (!species || (s.species || '') === species) && (!batchId || s.batchId === batchId)
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// A cell that starts with = + - @ can run as a formula when the file is opened in a spreadsheet; neutralise it.
const cell = (v) => {
  let t = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return `"${t.replace(/"/g, '""')}"`
}

const HEAD = ['date', 'time', 'batch', 'species', 'pl_stage', 'larva_size', 'method', 'counter_result', 'final_count', 'manual_count', 'other_app_count', 'marks_added', 'marks_removed', 'tray_id', 'notes']

export function countsCsv(rows, batches) {
  const byId = new Map(batches.map((b) => [b.id, b]))
  const lines = rows.map((s) => {
    const b = byId.get(s.batchId)
    const d = new Date(s.timestamp)
    return [
      d.toISOString().slice(0, 10), d.toTimeString().slice(0, 5), b?.code ?? '', s.species ?? '', b?.plStage ?? '', s.larvaSize ?? '', s.method ?? '',
      s.predicted ?? '', s.count, s.manualCount ?? '', s.otherCount ?? '', s.added ?? '', s.removed ?? '', s.trayId ?? '', s.notes ?? '',
    ].map(cell).join(',')
  })
  return [HEAD.join(','), ...lines].join('\n')
}
