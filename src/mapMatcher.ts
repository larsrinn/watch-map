import type { TurnInstruction } from './gpxParser'

export interface MapMatcherConfig {
  forwardWindowDistance: number
  backwardWindowDistance: number
  jumpThresholdRatio: number
  jumpConfirmFixes: number
}

export const DEFAULT_CONFIG: MapMatcherConfig = {
  forwardWindowDistance: 500,
  backwardWindowDistance: 50,
  jumpThresholdRatio: 0.3,
  jumpConfirmFixes: 3,
}

export interface NavigationState {
  currentIndex: number
  distanceToNextTurn: number | null
  nextTurn: TurnInstruction | null
  totalRemaining: number
  snappedPosition: [number, number]
}

export interface MapMatcher {
  updatePosition(lat: number, lon: number): NavigationState
  reset(): void
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function createMapMatcher(
  trackPoints: [number, number][],
  turns: TurnInstruction[],
  config: Partial<MapMatcherConfig> = {}
): MapMatcher {
  const cfg: MapMatcherConfig = { ...DEFAULT_CONFIG, ...config }
  const n = trackPoints.length

  if (n === 0) {
    return {
      updatePosition: () => ({
        currentIndex: 0,
        distanceToNextTurn: null,
        nextTurn: null,
        totalRemaining: 0,
        snappedPosition: [0, 0],
      }),
      reset: () => {},
    }
  }

  // cumulativeDist[i] = distance from trackPoints[0] to trackPoints[i]
  const cumulativeDist = new Array<number>(n).fill(0)
  const segmentLength = new Array<number>(Math.max(n - 1, 0)).fill(0)
  for (let i = 0; i < n - 1; i++) {
    segmentLength[i] = haversine(trackPoints[i], trackPoints[i + 1])
    cumulativeDist[i + 1] = cumulativeDist[i] + segmentLength[i]
  }
  const totalRouteLength = cumulativeDist[n - 1]

  let currentIndex = 0
  let jumpCandidateIndex: number | null = null
  let jumpConfirmCount = 0

  function reset() {
    currentIndex = 0
    jumpCandidateIndex = null
    jumpConfirmCount = 0
  }

  function distToPoint(lat: number, lon: number, ptIdx: number): number {
    return haversine([lat, lon], trackPoints[ptIdx])
  }

  function updatePosition(lat: number, lon: number): NavigationState {
    const curDist = cumulativeDist[currentIndex]

    // Compute window bounds based on distance along route
    let windowStart = currentIndex
    while (windowStart > 0 && curDist - cumulativeDist[windowStart - 1] <= cfg.backwardWindowDistance) {
      windowStart--
    }
    let windowEnd = currentIndex
    while (windowEnd < n - 1 && cumulativeDist[windowEnd + 1] - curDist <= cfg.forwardWindowDistance) {
      windowEnd++
    }

    // Find nearest point within window
    let localBestIdx = windowStart
    let localBestDist = distToPoint(lat, lon, windowStart)
    for (let i = windowStart + 1; i <= windowEnd; i++) {
      const d = distToPoint(lat, lon, i)
      if (d < localBestDist) {
        localBestDist = d
        localBestIdx = i
      }
    }

    // Find globally nearest point
    let globalBestIdx = 0
    let globalBestDist = distToPoint(lat, lon, 0)
    for (let i = 1; i < n; i++) {
      const d = distToPoint(lat, lon, i)
      if (d < globalBestDist) {
        globalBestDist = d
        globalBestIdx = i
      }
    }

    // Check if global jump is warranted (global candidate is significantly closer and outside window)
    const isOutsideWindow = globalBestIdx < windowStart || globalBestIdx > windowEnd
    if (isOutsideWindow && globalBestDist < localBestDist * cfg.jumpThresholdRatio) {
      if (jumpCandidateIndex === globalBestIdx) {
        jumpConfirmCount++
      } else {
        jumpCandidateIndex = globalBestIdx
        jumpConfirmCount = 1
      }
      if (jumpConfirmCount >= cfg.jumpConfirmFixes) {
        currentIndex = globalBestIdx
        localBestIdx = globalBestIdx
        jumpCandidateIndex = null
        jumpConfirmCount = 0
      } else {
        // Advance normally within window while waiting to confirm jump
        currentIndex = localBestIdx
      }
    } else {
      if (jumpCandidateIndex !== null) {
        jumpCandidateIndex = null
        jumpConfirmCount = 0
      }
      currentIndex = localBestIdx
    }

    // Interpolate position on segment [localBestIdx, localBestIdx+1]
    let snappedPosition: [number, number]
    let fractionalDist: number

    if (localBestIdx >= n - 1) {
      snappedPosition = trackPoints[n - 1]
      fractionalDist = totalRouteLength
    } else {
      const p0 = trackPoints[localBestIdx]
      const p1 = trackPoints[localBestIdx + 1]
      const dLat = p1[0] - p0[0]
      const dLon = p1[1] - p0[1]
      const segLen2 = dLat * dLat + dLon * dLon
      let t = 0
      if (segLen2 > 0) {
        const dot = (lat - p0[0]) * dLat + (lon - p0[1]) * dLon
        t = Math.max(0, Math.min(1, dot / segLen2))
      }
      snappedPosition = [p0[0] + t * dLat, p0[1] + t * dLon]
      fractionalDist = cumulativeDist[localBestIdx] + t * segmentLength[localBestIdx]
    }

    const nextTurn = turns.find(t => t.idx > localBestIdx) ?? null
    const distanceToNextTurn = nextTurn !== null
      ? Math.max(0, cumulativeDist[nextTurn.idx] - fractionalDist)
      : null
    const totalRemaining = Math.max(0, totalRouteLength - fractionalDist)

    return {
      currentIndex: localBestIdx,
      distanceToNextTurn,
      nextTurn,
      totalRemaining,
      snappedPosition,
    }
  }

  return { updatePosition, reset }
}
