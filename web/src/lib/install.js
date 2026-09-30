import { useEffect, useState } from 'react'

// Installing the app to the home screen. Chrome on Android fires one event that lets us open its install dialog; it fires
// early and only once, so it is captured at start-up. iPhone and other browsers have no such event, so the person is shown
// the steps instead. Either way there is always an "Install the app" button until the app is installed.
let evt = null
const listeners = new Set()
const ping = () => listeners.forEach((f) => f())

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); evt = e; ping() })
  window.addEventListener('appinstalled', () => { evt = null; ping() })
}

export const isStandalone = () => !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Returns 'accepted' | 'dismissed' when the browser's own dialog was used, or 'manual' when the steps must be shown. */
export async function promptInstall() {
  if (!evt) return 'manual'
  const e = evt
  evt = null
  ping()
  await e.prompt()
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' }))
  return r.outcome
}

export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((n) => n + 1)
    listeners.add(f)
    return () => listeners.delete(f)
  }, [])
  return { installed: isStandalone(), canPrompt: !!evt }
}
