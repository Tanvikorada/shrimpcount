/** Least-squares straight line through (day, weight) points. Returns null with fewer than 3 usable points. */
export function fitLine(points) {
  const p = points.filter((x) => Number.isFinite(x.day) && Number.isFinite(x.w))
  if (p.length < 3) return null
  const n = p.length
  const sx = p.reduce((a, c) => a + c.day, 0), sy = p.reduce((a, c) => a + c.w, 0)
  const sxx = p.reduce((a, c) => a + c.day * c.day, 0), sxy = p.reduce((a, c) => a + c.day * c.w, 0)
  const den = n * sxx - sx * sx
  if (den === 0) return null
  const slope = (n * sxy - sx * sy) / den
  return { slope, intercept: (sy - slope * sx) / n }
}

/** Days from the latest point until the fitted line reaches target weight; null if not growing or not computable. */
export function daysToTarget(points, target) {
  const line = fitLine(points)
  if (!line || !(line.slope > 0) || !(target > 0)) return null
  const last = Math.max(...points.map((x) => x.day))
  const dayAtTarget = (target - line.intercept) / line.slope
  return Math.max(0, Math.ceil(dayAtTarget - last))
}
