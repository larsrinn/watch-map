export type PreloadStatus =
  | { phase: 'idle' }
  | { phase: 'running'; done: number; total: number }
  | { phase: 'done'; cached: number }
  | { phase: 'error' }

const ZOOM_LEVELS = [14, 15, 16, 17]
const BUFFER = 2
const MAX_TILES = 3000
const CONCURRENCY = 6

function lon2tile(lon: number, z: number): number {
  return ((lon + 180) / 360) * (1 << z)
}

function lat2tile(lat: number, z: number): number {
  const r = lat * Math.PI / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * (1 << z)
}

function computeRequiredTiles(trackPoints: [number, number][]): string[] {
  const tileSet = new Set<string>()
  const byZoom: Map<number, Set<string>> = new Map(ZOOM_LEVELS.map(z => [z, new Set()]))

  for (const [lat, lon] of trackPoints) {
    for (const z of ZOOM_LEVELS) {
      const tx = Math.floor(lon2tile(lon, z))
      const ty = Math.floor(lat2tile(lat, z))
      const maxT = (1 << z) - 1
      const zSet = byZoom.get(z)!

      for (let dx = -BUFFER; dx <= BUFFER; dx++) {
        for (let dy = -BUFFER; dy <= BUFFER; dy++) {
          const x = ((tx + dx) % (maxT + 1) + (maxT + 1)) % (maxT + 1)
          const y = Math.max(0, Math.min(maxT, ty + dy))
          zSet.add(`${z}/${x}/${y}`)
        }
      }
    }
  }

  // Collect tiles, lower zoom levels first (kept if cap is hit)
  for (const z of ZOOM_LEVELS) {
    for (const key of byZoom.get(z)!) {
      tileSet.add(key)
      if (tileSet.size >= MAX_TILES) break
    }
    if (tileSet.size >= MAX_TILES) break
  }

  return Array.from(tileSet)
}

export async function preloadTiles(
  trackPoints: [number, number][],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ cached: number; failed: number }> {
  if (!('serviceWorker' in navigator)) {
    return { cached: 0, failed: 0 }
  }

  const keys = computeRequiredTiles(trackPoints)
  const total = keys.length
  let done = 0
  let cached = 0
  let failed = 0

  const queue = [...keys]

  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted) return
      const key = queue.shift()!
      const url = `https://tile.openstreetmap.org/${key}.png`
      try {
        const response = await fetch(url, { mode: 'cors', signal })
        if (response.ok) cached++
        else failed++
      } catch {
        if (signal?.aborted) return
        failed++
      }
      done++
      if (done % 5 === 0 || done === total) {
        onProgress(done, total)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { cached, failed }
}
