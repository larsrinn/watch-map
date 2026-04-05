import { describe, it, expect, vi } from 'vitest'

// Test the trimCache logic by re-implementing against mocked Cache API
// (sw.js is a plain JS service worker, so we test the core eviction logic here)

function createMockCache(entries: string[]) {
  const store = new Map(entries.map((k) => [k, `value-${k}`]))
  return {
    keys: vi.fn(async () =>
      [...store.keys()].map((k) => ({ url: k }) as unknown as Request)
    ),
    delete: vi.fn(async (req: Request) => {
      store.delete(req.url)
      return true
    }),
    _store: store,
  }
}

// Mirror of the trimCache function from sw.js
async function trimCache(
  cache: { keys: () => Promise<Request[]>; delete: (k: Request) => Promise<boolean> },
  maxEntries: number
) {
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map((k) => cache.delete(k)))
  }
}

describe('sw.js tile cache eviction', () => {
  it('does nothing when cache is under limit', async () => {
    const cache = createMockCache(['a', 'b', 'c'])
    await trimCache(cache, 5)
    expect(cache.delete).not.toHaveBeenCalled()
    expect(cache._store.size).toBe(3)
  })

  it('does nothing when cache is exactly at limit', async () => {
    const cache = createMockCache(['a', 'b', 'c'])
    await trimCache(cache, 3)
    expect(cache.delete).not.toHaveBeenCalled()
  })

  it('evicts oldest entries when cache exceeds limit', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => `tile-${i}`)
    const cache = createMockCache(entries)
    await trimCache(cache, 7)

    // Should delete the first 3 (oldest) entries
    expect(cache.delete).toHaveBeenCalledTimes(3)
    expect(cache._store.size).toBe(7)
    // Oldest entries removed
    expect(cache._store.has('tile-0')).toBe(false)
    expect(cache._store.has('tile-1')).toBe(false)
    expect(cache._store.has('tile-2')).toBe(false)
    // Newest entries kept
    expect(cache._store.has('tile-9')).toBe(true)
    expect(cache._store.has('tile-3')).toBe(true)
  })

  it('evicts down to exactly maxEntries', async () => {
    const entries = Array.from({ length: 550 }, (_, i) => `tile-${i}`)
    const cache = createMockCache(entries)
    await trimCache(cache, 500)

    expect(cache.delete).toHaveBeenCalledTimes(50)
    expect(cache._store.size).toBe(500)
  })

  it('handles empty cache', async () => {
    const cache = createMockCache([])
    await trimCache(cache, 500)
    expect(cache.delete).not.toHaveBeenCalled()
  })
})
