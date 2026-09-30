export const PARAMS = [
  { key: 'salinity', labelKey: 'wq_p_salinity', unit: 'ppt' },
  { key: 'ph', labelKey: 'wq_p_ph', unit: '' },
  { key: 'temp', labelKey: 'wq_p_temp', unit: '°C' },
  { key: 'do', labelKey: 'wq_p_do', unit: 'mg/L' },
  { key: 'ammonia', labelKey: 'wq_p_ammonia', unit: 'mg/L' },
  { key: 'nitrite', labelKey: 'wq_p_nitrite', unit: 'mg/L' },
  { key: 'alkalinity', labelKey: 'wq_p_alkalinity', unit: 'mg/L' },
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

