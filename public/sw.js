const TILE_CACHE = 'osm-tiles-v1'
const APP_CACHE = 'app-shell-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './favicon.svg',
      ])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('app-shell-') && k !== APP_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Tile requests: cache-first
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          if (cached) return cached
          return fetch(e.request).then((response) => {
            if (response.ok) {
              try {
                cache.put(e.request, response.clone())
              } catch {
                // QuotaExceededError or similar — ignore, partial caching is fine
              }
            }
            return response
          })
        })
      )
    )
    return
  }

  // Navigation requests: network-first, fall back to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    )
    return
  }

  // App assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(APP_CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const fetched = fetch(e.request).then((response) => {
            if (response.ok) {
              try { cache.put(e.request, response.clone()) } catch {}
            }
            return response
          })
          return cached || fetched
        })
      )
    )
  }
})
