import { describe, it, expect } from 'vitest'
import { createMapMatcher } from './mapMatcher'
import type { TurnInstruction } from './gpxParser'
import { haversine } from './geo'

// Helper: build a straight north-going route with n points, 0.001° lat apart (~111m/step)
function straightRoute(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => [50 + i * 0.001, 8.0] as [number, number])
}

// 5-point route with a turn at idx 3
const ROUTE_5 = straightRoute(5)
const TURNS_AT_3: TurnInstruction[] = [
  { idx: 3, text: 'right', icon: '↱' },
  { idx: 4, text: 'destination', icon: '🏁' },
]

describe('basic forward progression', () => {
  it('starts at index 0', () => {
    const m = createMapMatcher(ROUTE_5, TURNS_AT_3)
    const s = m.updatePosition(ROUTE_5[0][0], ROUTE_5[0][1])
    expect(s.currentIndex).toBe(0)
  })

  it('advances to next point when GPS moves forward', () => {
    const m = createMapMatcher(ROUTE_5, TURNS_AT_3)
    m.updatePosition(ROUTE_5[0][0], ROUTE_5[0][1])
    const s = m.updatePosition(ROUTE_5[1][0], ROUTE_5[1][1])
    expect(s.currentIndex).toBe(1)
  })

  it('advances to last point', () => {
    const m = createMapMatcher(ROUTE_5, TURNS_AT_3)
    for (const pt of ROUTE_5) m.updatePosition(pt[0], pt[1])
    const s = m.updatePosition(ROUTE_5[4][0], ROUTE_5[4][1])
    expect(s.currentIndex).toBe(4)
  })
})

describe('GPS jitter — no backward jumps', () => {
  it('does not go backward when position oscillates slightly', () => {
    const route = straightRoute(10)
    const m = createMapMatcher(route, [], { forwardWindowDistance: 500, backwardWindowDistance: 50 })

    // Advance to idx 5
    for (let i = 0; i <= 5; i++) m.updatePosition(route[i][0], route[i][1])

    // Jitter: oscillate 1m around idx 5
    const jitterOffset = 0.000009  // ~1m in degrees lat
    for (let tick = 0; tick < 10; tick++) {
      const offset = tick % 2 === 0 ? jitterOffset : -jitterOffset
      const s = m.updatePosition(route[5][0] + offset, route[5][1])
      // Should stay at 5 or advance, never drop significantly below
      expect(s.currentIndex).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('route close to itself — no jump to parallel segment', () => {
  // U-shape: go north 5 steps, then return south parallel (0.0001° east)
  const leg1: [number, number][] = [
    [50.000, 8.0000],
    [50.001, 8.0000],
    [50.002, 8.0000],
    [50.003, 8.0000],
    [50.004, 8.0000],
  ]
  const turn: [number, number] = [50.005, 8.0000]
  const leg2: [number, number][] = [
    [50.004, 8.0001],
    [50.003, 8.0001],
    [50.002, 8.0001],
    [50.001, 8.0001],
    [50.000, 8.0001],
  ]
  const uRoute: [number, number][] = [...leg1, turn, ...leg2]
  // Parallel return leg is ~7m to the east of leg1

  it('does not jump to return leg while on outgoing leg', () => {
    const m = createMapMatcher(uRoute, [], {
      jumpConfirmFixes: 3,
      jumpThresholdRatio: 0.3,
    })

    // Walk along leg1 (idx 0–4)
    for (let i = 0; i <= 4; i++) {
      const s = m.updatePosition(leg1[i][0], leg1[i][1])
      // Should stay on first leg (idx ≤ 5), not jump to idx 6-10
      expect(s.currentIndex).toBeLessThanOrEqual(5)
    }
  })

  it('global candidate 7m away does not satisfy jump threshold when on exact trackpoint', () => {
    const m = createMapMatcher(uRoute, [], { jumpConfirmFixes: 3, jumpThresholdRatio: 0.3 })

    // User exactly on leg1[2] (idx 2). Parallel point leg2[2] (idx 8) is ~7m away.
    // localBestDist = ~0m → threshold = 0 * 0.3 = 0 → no jump possible
    m.updatePosition(uRoute[0][0], uRoute[0][1])
    m.updatePosition(uRoute[1][0], uRoute[1][1])
    const s = m.updatePosition(leg1[2][0], leg1[2][1])
    expect(s.currentIndex).toBe(2)
  })
})

describe('intentional shortcut — jumps after confirmations', () => {
  it('jumps to distant point after jumpConfirmFixes consecutive fixes', () => {
    // Long route: 50 points, each ~111m apart
    const route = straightRoute(50)
    const m = createMapMatcher(route, [], {
      forwardWindowDistance: 500,
      jumpThresholdRatio: 0.3,
      jumpConfirmFixes: 3,
    })

    // Start near idx 0
    m.updatePosition(route[0][0], route[0][1])

    // User teleports to near idx 45 (well beyond 500m forward window)
    // Idx 45 is at 45*111m = ~4995m from start
    // localBest from idx 0 area: ~4995m; globalBest at idx 45: ~0m
    // 0m < 4995m * 0.3 = 1498m → threshold met
    const farPt = route[45]

    const s1 = m.updatePosition(farPt[0], farPt[1])
    expect(s1.currentIndex).toBeLessThan(45)  // not yet jumped after 1 fix

    const s2 = m.updatePosition(farPt[0], farPt[1])
    expect(s2.currentIndex).toBeLessThan(45)  // not yet after 2 fixes

    const s3 = m.updatePosition(farPt[0], farPt[1])
    expect(s3.currentIndex).toBe(45)  // jumped after 3rd fix
  })

  it('resets confirmation count if GPS drifts to a different distant point', () => {
    const route = straightRoute(50)
    const m = createMapMatcher(route, [], {
      forwardWindowDistance: 500,
      jumpThresholdRatio: 0.3,
      jumpConfirmFixes: 3,
    })
    m.updatePosition(route[0][0], route[0][1])

    // Two fixes near idx 45, then one near idx 40 — count should reset
    m.updatePosition(route[45][0], route[45][1])
    m.updatePosition(route[45][0], route[45][1])
    m.updatePosition(route[40][0], route[40][1])  // different candidate → reset count

    // One more fix at idx 45: count is 1, not 3 → no jump yet
    const s = m.updatePosition(route[45][0], route[45][1])
    expect(s.currentIndex).toBeLessThan(40)
  })
})

describe('interpolation between trackpoints', () => {
  it('gives fractional distance at midpoint of segment', () => {
    const route = straightRoute(5)
    const segLen = haversine(route[1], route[2])
    const m = createMapMatcher(route, [])

    // Advance to idx 1
    m.updatePosition(route[0][0], route[0][1])
    m.updatePosition(route[1][0], route[1][1])

    // Position at exact midpoint between idx 1 and idx 2
    const midLat = (route[1][0] + route[2][0]) / 2
    const midLon = (route[1][1] + route[2][1]) / 2
    const s = m.updatePosition(midLat, midLon)

    // Fractional dist = cumDist[1] + 0.5 * segLen[1..2]
    // We check totalRemaining drops by half a segment compared to standing on idx 1
    const sAtIdx1 = createMapMatcher(route, [])
    sAtIdx1.updatePosition(route[1][0], route[1][1])
    const stateAtIdx1 = sAtIdx1.updatePosition(route[1][0], route[1][1])

    expect(stateAtIdx1.totalRemaining - s.totalRemaining).toBeCloseTo(segLen / 2, 0)
  })

  it('snappedPosition lies on the segment between matched trackpoints', () => {
    const route = straightRoute(5)
    const m = createMapMatcher(route, [])
    m.updatePosition(route[1][0], route[1][1])

    // Position 25% of the way from idx 1 to idx 2, offset 1m east (closer to idx 1)
    const quarterLat = route[1][0] + 0.00025  // 25% between idx 1 and idx 2
    const quarterLon = route[1][1] + 0.000009  // ~1m east

    const s = m.updatePosition(quarterLat, quarterLon)

    // Snapped position should be on the segment between idx 1 and idx 2
    expect(s.snappedPosition[0]).toBeGreaterThan(route[1][0])
    expect(s.snappedPosition[0]).toBeLessThan(route[2][0])
    expect(s.snappedPosition[1]).toBeCloseTo(route[1][1], 5)  // projected onto segment (lon = 8.0)
  })
})

describe('distance to next turn', () => {
  it('computes correct distance from current position to next turn', () => {
    const route = straightRoute(5)
    const turns: TurnInstruction[] = [{ idx: 3, text: 'right', icon: '↱' }]
    const m = createMapMatcher(route, turns)

    // Advance to idx 1
    m.updatePosition(route[0][0], route[0][1])
    const s = m.updatePosition(route[1][0], route[1][1])

    // Expected: distance from idx 1 to idx 3 = 2 segments
    const expected = haversine(route[1], route[2]) + haversine(route[2], route[3])
    expect(s.distanceToNextTurn).not.toBeNull()
    expect(s.distanceToNextTurn!).toBeCloseTo(expected, 0)
  })

  it('returns the correct next turn instruction', () => {
    const route = straightRoute(5)
    const turns: TurnInstruction[] = [
      { idx: 2, text: 'left', icon: '↰' },
      { idx: 4, text: 'destination', icon: '🏁' },
    ]
    const m = createMapMatcher(route, turns)
    m.updatePosition(route[0][0], route[0][1])
    const s = m.updatePosition(route[1][0], route[1][1])
    // At idx 1, next turn is idx 2
    expect(s.nextTurn?.idx).toBe(2)
    expect(s.nextTurn?.text).toBe('left')
  })

  it('advances to next turn after passing one', () => {
    const route = straightRoute(5)
    const turns: TurnInstruction[] = [
      { idx: 2, text: 'left', icon: '↰' },
      { idx: 4, text: 'destination', icon: '🏁' },
    ]
    const m = createMapMatcher(route, turns)
    m.updatePosition(route[0][0], route[0][1])
    m.updatePosition(route[1][0], route[1][1])
    m.updatePosition(route[2][0], route[2][1])
    const s = m.updatePosition(route[3][0], route[3][1])
    // At idx 3, turn at idx 2 is passed, next is idx 4
    expect(s.nextTurn?.idx).toBe(4)
  })
})

describe('no turns (distance-only mode)', () => {
  it('returns null distanceToNextTurn when there are no turns', () => {
    const route = straightRoute(5)
    const m = createMapMatcher(route, [])
    const s = m.updatePosition(route[0][0], route[0][1])
    expect(s.distanceToNextTurn).toBeNull()
    expect(s.nextTurn).toBeNull()
  })

  it('still returns correct totalRemaining with no turns', () => {
    const route = straightRoute(5)
    const m = createMapMatcher(route, [])
    const s = m.updatePosition(route[0][0], route[0][1])

    const totalRouteLength =
      haversine(route[0], route[1]) +
      haversine(route[1], route[2]) +
      haversine(route[2], route[3]) +
      haversine(route[3], route[4])

    expect(s.totalRemaining).toBeCloseTo(totalRouteLength, 0)
  })
})

describe('spatial index — global search performance', () => {
  it('finds global best on a large route without scanning all points', () => {
    // 1000-point route — old code would do 1000 haversine calls per fix,
    // spatial index checks only nearby grid cells
    const route = straightRoute(1000)
    const m = createMapMatcher(route, [], {
      forwardWindowDistance: 500,
      jumpConfirmFixes: 3,
      jumpThresholdRatio: 0.3,
    })

    // Start at beginning
    m.updatePosition(route[0][0], route[0][1])

    // Teleport to idx 900 — spatial index must still find it
    const far = route[900]
    m.updatePosition(far[0], far[1])
    m.updatePosition(far[0], far[1])
    const s = m.updatePosition(far[0], far[1]) // 3rd fix → jump
    expect(s.currentIndex).toBe(900)
  })

  it('works when GPS position is far from any track point', () => {
    const route = straightRoute(10)
    const m = createMapMatcher(route, [])

    // Position very far from any point on the route (different grid cell, no nearby hits)
    const s = m.updatePosition(60.0, 20.0)
    // Should still return a valid state (falls back to local best)
    expect(s.currentIndex).toBeGreaterThanOrEqual(0)
    expect(s.currentIndex).toBeLessThan(10)
  })

  it('jumps correctly on a route that crosses grid cell boundaries', () => {
    // Route spanning multiple grid cells (each cell is 0.01°)
    const route: [number, number][] = Array.from({ length: 50 }, (_, i) => [
      50 + i * 0.005, // 0.005° steps → crosses cell boundary every 2 points
      8 + i * 0.005,
    ])
    const m = createMapMatcher(route, [], {
      forwardWindowDistance: 500,
      jumpConfirmFixes: 3,
      jumpThresholdRatio: 0.3,
    })

    // Start at beginning
    m.updatePosition(route[0][0], route[0][1])

    // Teleport to idx 25 (well beyond forward window)
    const target = route[25]
    m.updatePosition(target[0], target[1])
    m.updatePosition(target[0], target[1])
    const s = m.updatePosition(target[0], target[1]) // 3rd fix → jump
    expect(s.currentIndex).toBe(25)
  })
})

describe('edge cases', () => {
  it('handles start of route correctly', () => {
    const route = straightRoute(5)
    const m = createMapMatcher(route, TURNS_AT_3)
    const s = m.updatePosition(route[0][0], route[0][1])
    expect(s.currentIndex).toBe(0)
    expect(s.totalRemaining).toBeGreaterThan(0)
  })

  it('handles end of route correctly — totalRemaining near zero', () => {
    const route = straightRoute(5)
    const m = createMapMatcher(route, TURNS_AT_3)
    for (const pt of route) m.updatePosition(pt[0], pt[1])
    const s = m.updatePosition(route[4][0], route[4][1])
    expect(s.currentIndex).toBe(4)
    expect(s.totalRemaining).toBeCloseTo(0, 0)
  })

  it('past last turn — nextTurn is null', () => {
    const route = straightRoute(5)
    const turns: TurnInstruction[] = [{ idx: 2, text: 'left', icon: '↰' }]
    const m = createMapMatcher(route, turns)
    for (const pt of route) m.updatePosition(pt[0], pt[1])
    const s = m.updatePosition(route[4][0], route[4][1])
    // idx 4 > idx 2 → no more turns ahead
    expect(s.nextTurn).toBeNull()
    expect(s.distanceToNextTurn).toBeNull()
  })

  it('reset() brings matcher back to start', () => {
    const route = straightRoute(10)
    const m = createMapMatcher(route, [])
    for (const pt of route) m.updatePosition(pt[0], pt[1])
    m.reset()
    const s = m.updatePosition(route[0][0], route[0][1])
    expect(s.currentIndex).toBe(0)
  })

  it('handles empty route gracefully', () => {
    const m = createMapMatcher([], [])
    const s = m.updatePosition(50.0, 8.0)
    expect(s.currentIndex).toBe(0)
    expect(s.totalRemaining).toBe(0)
    expect(s.nextTurn).toBeNull()
  })

  it('handles single-point route', () => {
    const route: [number, number][] = [[50.0, 8.0]]
    const m = createMapMatcher(route, [])
    const s = m.updatePosition(50.0, 8.0)
    expect(s.currentIndex).toBe(0)
    expect(s.totalRemaining).toBe(0)
  })
})
