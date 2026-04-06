import { describe, it, expect } from 'vitest'

/**
 * Verifies the GPS watcher effect dependency arrays in usePosition.
 * We import the raw source as a string via Vite's ?raw query.
 */
const source = (await import('./usePosition.ts?raw')).default

describe('usePosition GPS watcher stability', () => {
  it('GPS tracking effect should depend only on manualPosition', () => {
    const watchBlock = source.indexOf('watchPosition')
    expect(watchBlock).toBeGreaterThan(-1)

    const afterWatch = source.slice(watchBlock)
    const clearWatchIdx = afterWatch.indexOf('clearWatch')
    expect(clearWatchIdx).toBeGreaterThan(-1)

    const afterClearWatch = afterWatch.slice(clearWatchIdx)
    const depsMatch = afterClearWatch.match(/\},\s*\[manualPosition\]\)/)
    expect(depsMatch).not.toBeNull()
  })

  it('matcher recreation effect should depend on trackPoints and turns', () => {
    const matcherBlock = source.indexOf('createMapMatcher(trackPoints')
    expect(matcherBlock).toBeGreaterThan(-1)

    const afterMatcher = source.slice(matcherBlock)
    const depsMatch = afterMatcher.match(/\},\s*\[trackPoints,\s*turns\]\)/)
    expect(depsMatch).not.toBeNull()
  })
})
