const TILE_CACHE = 'osm-tiles-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.hostname !== 'tile.openstreetmap.org') return

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
})
