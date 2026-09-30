// App-shell cache so the app opens with no signal. Files from this site are saved as they are used and served from the
// cache when the network is not there. API calls (other origins) are never cached.
const CACHE = 'shrimpcount-shell-v3'
// Paths are relative to where the app is served ("/" or "/app/"), taken from the worker's own scope.
const BASE = new URL(self.registration.scope).pathname

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll([BASE, `${BASE}icon.svg`, `${BASE}icon-192.png`, `${BASE}manifest.webmanifest`])
      // also save the app's own script and style files (named in the page) so the very first visit works offline too
      const html = await (await fetch(BASE)).text()
      const files = [...new Set(html.match(/[^"']*\/assets\/[^"']+\.(?:js|css)/g) || [])]
      await c.addAll(files)
    }).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
      // offline: the exact file if we have it, otherwise the app itself (all screens live behind the same page)
      .catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match(BASE) : Response.error()))),
  )
})
