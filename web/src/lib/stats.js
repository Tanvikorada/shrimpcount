// Pure statistics for a batch. Kept free of browser APIs so it can be unit-tested with node.

/**
 * Several photos of the SAME tray share a trayId. Their counts are averaged into one value for that tray, so a
 * batch's "samples" are trays, not photos. A sample without a trayId is its own tray.
 */
export function batchStats(batch, samples) {
  const mine = samples.filter((s) => s.batchId === batch.id)
  const trays = new Map()
  for (const s of mine) {
    const key = s.trayId || s.id
    if (!trays.has(key)) trays.set(key, [])
    trays.get(key).push(Number(s.count))
  }
  const v = [...trays.values()].map((a) => a.reduce((x, y) => x + y, 0) / a.length)
  const n = v.length
  if (!n) return { n: 0, shots: 0 }
  const mean = v.reduce((a, c) => a + c, 0) / n
  const sd = n > 1 ? Math.sqrt(v.reduce((a, c) => a + (c - mean) ** 2, 0) / (n - 1)) : 0
  const vol = (Number(batch.tankVolumeL) * 1000) / Number(batch.sampleVolumeMl)
  return {
    n, shots: mine.length, mean, sd, cv: mean ? (sd / mean) * 100 : 0, min: Math.min(...v), max: Math.max(...v),
    estTotal: Number.isFinite(vol) && vol > 0 ? Math.round(mean * vol) : null,
  }
}
