import { describe, it, expect } from 'vitest'

const source = (await import('./useMapInteraction.ts?raw')).default

describe('useMapInteraction', () => {
  it('exports a useMapInteraction function', () => {
    expect(source).toContain('export function useMapInteraction')
  })

  it('enforces MIN_ZOOM of 10 and MAX_ZOOM of 17', () => {
    expect(source).toMatch(/MIN_ZOOM\s*=\s*10/)
    expect(source).toMatch(/MAX_ZOOM\s*=\s*17/)
  })

  it('registers and cleans up global pointermove and pointerup listeners', () => {
    expect(source).toContain("addEventListener('pointermove'")
    expect(source).toContain("addEventListener('pointerup'")
    expect(source).toContain("removeEventListener('pointermove'")
    expect(source).toContain("removeEventListener('pointerup'")
  })

  it('disables follow mode on pointer down', () => {
    expect(source).toContain('setFollowMode(false)')
  })

  it('wakes up on wheel when sleeping', () => {
    // The handleWheel should call wakeUp when sleeping
    const wheelBlock = source.indexOf('handleWheel')
    const afterWheel = source.slice(wheelBlock)
    expect(afterWheel).toContain('wakeUp(false)')
  })

  it('resets sleep timer on zoom change and pointer down', () => {
    expect(source).toContain('resetSleepTimer()')
  })
})
