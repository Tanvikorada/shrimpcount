// Pure calculator functions. Kept separate so they can be unit-tested.
const num = (v) => (v === '' || v == null ? NaN : Number(v))

/** Survival rate (%) = harvested / stocked * 100 */
export function survivalRate(stocked, harvested) {
  const s = num(stocked), h = num(harvested)
  if (!(s > 0) || !(h >= 0)) return NaN
  return (h / s) * 100
}

/** Tank volume in litres. shape: 'rect' (L, W, D metres) or 'round' (diameter, D metres). */
export function tankVolumeL(shape, a, b, depth) {
  const d = num(depth)
  if (shape === 'round') {
    const dia = num(a)
    return dia > 0 && d > 0 ? Math.PI * (dia / 2) ** 2 * d * 1000 : NaN
  }
  const l = num(a), w = num(b)
  return l > 0 && w > 0 && d > 0 ? l * w * d * 1000 : NaN
}

/** Biomass (kg) and daily feed (kg) from stocking count, survival %, average body weight (g), feed rate (% of biomass). */
export function dailyFeed(stocked, survivalPct, abwG, ratePct) {
  const n = num(stocked), s = num(survivalPct), w = num(abwG), r = num(ratePct)
  if (!(n > 0) || !(s >= 0) || !(w > 0) || !(r >= 0)) return { biomassKg: NaN, feedKg: NaN }
  const biomassKg = (n * (s / 100) * w) / 1000
  return { biomassKg, feedKg: biomassKg * (r / 100) }
}

/** Feed conversion ratio = feed given (kg) / biomass gained (kg) */
export function fcr(feedKg, gainKg) {
  const f = num(feedKg), g = num(gainKg)
  return f >= 0 && g > 0 ? f / g : NaN
}

/** Volumetric estimate: mean sample count * (tank volume L * 1000 / sample volume mL) */
export function volumetricTotal(meanCount, tankL, sampleMl) {
  const m = num(meanCount), t = num(tankL), v = num(sampleMl)
  return m >= 0 && t > 0 && v > 0 ? m * ((t * 1000) / v) : NaN
}
