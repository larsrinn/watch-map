import { describe, it, expect } from 'vitest'

const source = (await import('./useScreenNavigation.ts?raw')).default

describe('useScreenNavigation', () => {
  it('exports a useScreenNavigation function', () => {
    expect(source).toContain('export function useScreenNavigation')
  })

  it('supports 4 screens', () => {
    expect(source).toMatch(/SCREEN_COUNT\s*=\s*4/)
  })

  it('handles keyboard ArrowRight and ArrowLeft', () => {
    expect(source).toContain("e.key === 'ArrowRight'")
    expect(source).toContain("e.key === 'ArrowLeft'")
  })

  it('clamps screen index within valid range', () => {
    expect(source).toContain('Math.min(s + 1, SCREEN_COUNT - 1)')
    expect(source).toContain('Math.max(s - 1, 0)')
  })

  it('registers touch event listeners for swipe navigation', () => {
    expect(source).toContain("addEventListener('touchstart'")
    expect(source).toContain("addEventListener('touchend'")
  })

  it('cleans up all event listeners', () => {
    expect(source).toContain("removeEventListener('keydown'")
    expect(source).toContain("removeEventListener('touchstart'")
    expect(source).toContain("removeEventListener('touchend'")
  })

  it('requires minimum 40px horizontal swipe distance', () => {
    expect(source).toContain('Math.abs(dx) < 40')
  })

  it('returns a goToScreen callback', () => {
    expect(source).toContain('goToScreen')
  })
})
