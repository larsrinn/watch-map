import { describe, it, expect } from 'vitest'
import { haversine } from './geo'

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
