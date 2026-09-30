export const PARAMS = [
  { key: 'salinity', label: 'Salinity', unit: 'ppt' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'temp', label: 'Temp', unit: '°C' },
  { key: 'do', label: 'DO', unit: 'mg/L' },
  { key: 'ammonia', label: 'Ammonia', unit: 'mg/L' },
  { key: 'nitrite', label: 'Nitrite', unit: 'mg/L' },
  { key: 'alkalinity', label: 'Alkalinity', unit: 'mg/L' },
]

// Generic starting ranges for a few parameters only. Confirm with your hatchery and edit below.
const DEFAULTS = { ph: [7.5, 8.5], temp: [26, 33], do: [4, null] }

export const rangeFor = (settings, key) => settings.ranges?.[key] ?? DEFAULTS[key] ?? [null, null]
export const outOfRange = (settings, key, v) => {
  if (v === '' || v == null) return false
  const [lo, hi] = rangeFor(settings, key)
  const n = Number(v)
  return (lo != null && n < lo) || (hi != null && n > hi)
}

