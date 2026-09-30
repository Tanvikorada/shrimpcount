// Has this person been through the front door (landing, sign-in or "continue without an account")? Kept on the phone.
const KEY = 'shrimpcount.entered'

export const markEntered = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode: they will just see the front door again */ } }

export function hasEntered(store, cloud) {
  try { if (localStorage.getItem(KEY) === '1') return true } catch { /* ignore */ }
  // anyone who already has records, or an account, is not new: never send them back to the front page
  return (store.batches?.length || 0) > 0 || (store.samples?.length || 0) > 0 || !!cloud?.user
}

export const isInstalledApp = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true } catch { return false }
}
