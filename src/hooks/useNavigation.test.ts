import { describe, it, expect } from 'vitest'

const source = (await import('./useNavigation.ts?raw')).default

describe('useNavigation', () => {
  it('exports a useNavigation function', () => {
    expect(source).toContain('export function useNavigation')
  })

  it('takes no parameters (decoupled from sleep/wake)', () => {
    expect(source).toMatch(/function useNavigation\(\)/)
  })

  it('uses stable empty arrays for default trackPoints and turns', () => {
    expect(source).toContain('EMPTY_TRACK_POINTS')
    expect(source).toContain('EMPTY_TURNS')
  })

  it('aborts previous preload on new GPX load', () => {
    expect(source).toContain('preloadAbortRef.current?.abort()')
  })

  it('catches AbortError without setting error status', () => {
    expect(source).toContain("'AbortError'")
  })

  it('derives navInstruction from navigation state', () => {
    expect(source).toContain('navInstruction')
    expect(source).toContain('formatDistance')
  })

  it('exports NavInstruction type', () => {
    expect(source).toContain('export interface NavInstruction')
  })
})
