// App-shell service worker. Deliberately tiny and safe for a financial app:
// - it only handles top-level page navigations (never /api, Supabase, or
//   assets, so no financial data is ever cached),
// - network-first, so a new deploy is always picked up immediately and the
//   app's stale-build check keeps working; the cached shell is used only when
//   the network is unavailable.
const SHELL = 'shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
        }
        return res
      })
      .catch(() => caches.match('/').then((r) => r || Response.error())),
  )
})
