import { describe, it, expect } from 'vitest'
import { haversine, formatDistance } from './geo'

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine([50, 8], [50, 8])).toBe(0)
  })

  it('computes ~111 km for 1° latitude difference on the equator', () => {
    const dist = haversine([0, 0], [1, 0])
    expect(dist).toBeGreaterThan(110_000)
    expect(dist).toBeLessThan(112_000)
  })

  it('computes ~111 km for 1° longitude difference on the equator', () => {
    const dist = haversine([0, 0], [0, 1])
    expect(dist).toBeGreaterThan(110_000)
    expect(dist).toBeLessThan(112_000)
  })

  it('is symmetric', () => {
    const a: [number, number] = [48.8566, 2.3522] // Paris
    const b: [number, number] = [51.5074, -0.1278] // London
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6)
  })

  it('computes ~343 km for Paris–London', () => {
    const paris: [number, number] = [48.8566, 2.3522]
    const london: [number, number] = [51.5074, -0.1278]
    const dist = haversine(paris, london)
    expect(dist).toBeGreaterThan(340_000)
    expect(dist).toBeLessThan(345_000)
  })

  it('handles antipodal points (~20,000 km)', () => {
    const dist = haversine([0, 0], [0, 180])
    expect(dist).toBeGreaterThan(20_000_000)
    expect(dist).toBeLessThan(20_040_000)
  })
})

describe('formatDistance', () => {
  it('formats small distances in meters', () => {
    expect(formatDistance(42)).toMatch(/42\s*m/)
    expect(formatDistance(0)).toMatch(/0\s*m/)
    expect(formatDistance(99)).toMatch(/99\s*m/)
  })

  it('formats distances between 100-300m with 2 decimal km', () => {
    const result = formatDistance(150)
    expect(result).toContain('km')
    // 0.15 km — should have 2 decimal places
    expect(result).toMatch(/0[.,]15/)
  })

  it('formats distances >= 300m with 1 decimal km', () => {
    const result = formatDistance(1500)
    expect(result).toContain('km')
    // 1.5 km — should have 1 decimal place
    expect(result).toMatch(/1[.,]5/)
  })

  it('rounds meters to whole numbers', () => {
    expect(formatDistance(42.7)).toMatch(/43\s*m/)
  })
})
