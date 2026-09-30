import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initInstall } from './lib/install'

initInstall() // the browser's install event fires early and once
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

// The launch splash (in index.html) plays its full animation the first time and a short one after that. It leaves when the
// app has drawn AND the animation has had its time. "?holdsplash" keeps it on screen (used to check the animation frame by frame).
const splash = document.getElementById('splash')
const quick = !!splash?.classList.contains('quick')
const hideSplash = () => {
  if (!splash) return
  splash.classList.add('gone')
  setTimeout(() => splash.remove(), 500)
  try { localStorage.setItem('shrimpcount.launched', '1') } catch { /* ignore */ }
}
if (!location.search.includes('holdsplash')) {
  const minShown = quick ? 650 : 1900
  const wait = Math.max(0, minShown - performance.now())
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(hideSplash, wait)))
  setTimeout(hideSplash, minShown + 1500)   // never stay on screen
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const had = !!navigator.serviceWorker.controller
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  // a newer version took over while the app was open: tell the app so it can offer a reload
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) window.dispatchEvent(new Event('sc-updated')) })
}
