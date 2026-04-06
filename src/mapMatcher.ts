import type { TurnInstruction } from './gpxParser'
import { haversine } from './geo'

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
  offTrackDistance: number
}

export interface MapMatcher {
  updatePosition(lat: number, lon: number): NavigationState
  reset(): void
}

// Grid cell size in degrees (~1km at mid-latitudes)
const GRID_CELL_SIZE = 0.01

function cellKey(lat: number, lon: number): string {
  const r = Math.floor(lat / GRID_CELL_SIZE)
  const c = Math.floor(lon / GRID_CELL_SIZE)
  return `${r},${c}`
}

function buildSpatialIndex(trackPoints: [number, number][]): Map<string, number[]> {
  const grid = new Map<string, number[]>()
  for (let i = 0; i < trackPoints.length; i++) {
    const key = cellKey(trackPoints[i][0], trackPoints[i][1])
    let bucket = grid.get(key)
    if (!bucket) {
      bucket = []
      grid.set(key, bucket)
    }
    bucket.push(i)
  }
  return grid
}

function getNearbyIndices(grid: Map<string, number[]>, lat: number, lon: number): number[] {
  const r = Math.floor(lat / GRID_CELL_SIZE)
  const c = Math.floor(lon / GRID_CELL_SIZE)
  const result: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const bucket = grid.get(`${r + dr},${c + dc}`)
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          result.push(bucket[i])
        }
      }
    }
  }
  return result
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
        offTrackDistance: 0,
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

  // Spatial index for fast global nearest-point lookup
  const spatialGrid = buildSpatialIndex(trackPoints)

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

  let prevIndex = 0

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

    // Find globally nearest point using spatial index (checks nearby grid cells only)
    const nearby = getNearbyIndices(spatialGrid, lat, lon)
    let globalBestIdx = nearby.length > 0 ? nearby[0] : localBestIdx
    let globalBestDist = nearby.length > 0 ? distToPoint(lat, lon, nearby[0]) : localBestDist
    for (let k = 1; k < nearby.length; k++) {
      const d = distToPoint(lat, lon, nearby[k])
      if (d < globalBestDist) {
        globalBestDist = d
        globalBestIdx = nearby[k]
      }
    }
    // If no nearby candidates found, fall back to local best (no jump possible)
    if (nearby.length === 0) {
      globalBestDist = localBestDist
      globalBestIdx = localBestIdx
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
      console.log('[MapMatcher] Jump candidate:', {
        from: currentIndex,
        to: globalBestIdx,
        confirmCount: jumpConfirmCount,
        needed: cfg.jumpConfirmFixes,
        globalDist: Math.round(globalBestDist),
        localDist: Math.round(localBestDist),
      })
      if (jumpConfirmCount >= cfg.jumpConfirmFixes) {
        console.log('[MapMatcher] Jump confirmed! Moving from track point', currentIndex, '→', globalBestIdx)
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
        console.log('[MapMatcher] Jump candidate reset (no longer warranted)')
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

    const offTrackDistance = haversine([lat, lon], snappedPosition)

    if (localBestIdx !== prevIndex) {
      console.log('[MapMatcher] Track point changed:', prevIndex, '→', localBestIdx,
        '| offTrack:', Math.round(offTrackDistance) + 'm',
        '| remaining:', Math.round(totalRemaining) + 'm',
        nextTurn ? `| next turn: "${nextTurn.text}" in ${Math.round(distanceToNextTurn ?? 0)}m` : '| no upcoming turn')
      prevIndex = localBestIdx
    }

    return {
      currentIndex: localBestIdx,
      distanceToNextTurn,
      nextTurn,
      totalRemaining,
      snappedPosition,
      offTrackDistance,
    }
  }

  return { updatePosition, reset }
}
