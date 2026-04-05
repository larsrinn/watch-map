const TILE_CACHE = 'osm-tiles-v1'
const APP_CACHE = 'app-shell-v1'
const MAX_TILES = 500
const EVICT_CHECK_INTERVAL = 50
let tileWriteCount = 0

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map((k) => cache.delete(k)))
  }
}

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
          .filter((k) =>
            (k.startsWith('app-shell-') && k !== APP_CACHE) ||
            (k.startsWith('osm-tiles-') && k !== TILE_CACHE)
          )
          .map((k) => caches.delete(k))
      )
    )
    .then(() => trimCache(TILE_CACHE, MAX_TILES))
    .then(() => self.clients.claim())
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
                tileWriteCount++
                if (tileWriteCount % EVICT_CHECK_INTERVAL === 0) {
                  trimCache(TILE_CACHE, MAX_TILES)
                }
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
