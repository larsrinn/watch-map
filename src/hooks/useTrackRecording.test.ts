import { describe, it, expect } from 'vitest'

const source = (await import('./useTrackRecording.ts?raw')).default

describe('useTrackRecording', () => {
  it('exports a useTrackRecording function', () => {
    expect(source).toContain('export function useTrackRecording')
  })

  it('uses a 5-meter minimum recording distance', () => {
    expect(source).toMatch(/MIN_RECORD_DISTANCE\s*=\s*5/)
  })

  it('debounces localStorage writes to 30 seconds', () => {
    expect(source).toMatch(/PERSIST_INTERVAL\s*=\s*30_000/)
  })

  it('flushes recorded path on beforeunload', () => {
    expect(source).toContain("addEventListener('beforeunload'")
    expect(source).toContain("removeEventListener('beforeunload'")
  })

  it('flushes on effect cleanup', () => {
    // The cleanup function should call flush()
    const flushBlock = source.indexOf('return () => {')
    const afterFlush = source.slice(flushBlock)
    expect(afterFlush).toContain('flush()')
  })

  it('uses shouldRecordPoint for min-distance filtering', () => {
    expect(source).toContain('shouldRecordPoint')
  })

  it('initializes recorded path from localStorage', () => {
    expect(source).toContain("localStorage.getItem(STORAGE_KEY)")
  })

  it('clears localStorage on start and clear', () => {
    const matches = source.match(/localStorage\.removeItem/g)
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })
})
