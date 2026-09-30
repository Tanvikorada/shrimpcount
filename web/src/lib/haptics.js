// A tiny tap of vibration on phones that support it, so buttons feel like buttons. Safe to call anywhere.
export const tap = (ms = 8) => { try { navigator.vibrate?.(ms) } catch { /* not supported */ } }

/** Text size: normal, large, xl. Stored on the phone and applied to the whole app. */
export const TEXT_SIZES = [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']]
export function applyTextSize(size) {
  const s = TEXT_SIZES.some(([k]) => k === size) ? size : 'large'
  document.documentElement.dataset.text = s
}
