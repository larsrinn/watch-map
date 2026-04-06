import { useState, useEffect, useRef, useCallback } from 'react'
import { createMapMatcher, DEFAULT_CONFIG } from '../mapMatcher'
import type { MapMatcher, NavigationState } from '../mapMatcher'
import type { TurnInstruction } from '../gpxParser'

function makeInitialNavState(trackPoints: [number, number][], turns: TurnInstruction[]): NavigationState {
  const matcher = createMapMatcher(trackPoints, turns)
  if (trackPoints.length === 0) return matcher.updatePosition(0, 0)
  return matcher.updatePosition(trackPoints[0][0], trackPoints[0][1])
}

export function usePosition(
  trackPoints: [number, number][],
  turns: TurnInstruction[]
): {
  position: [number, number]
  segmentIdx: number
  navigationState: NavigationState
  altitude: number | null
  isActive: boolean
  setManualPosition: (lat: number, lon: number) => void
} {
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null)
  const [gpsAltitude, setGpsAltitude] = useState<number | null>(null)
  const [hasGpsFix, setHasGpsFix] = useState(false)
  const [manualPosition, setManualPositionState] = useState<[number, number] | null>(null)
  const [navigationState, setNavigationState] = useState<NavigationState>(
    () => makeInitialNavState(trackPoints, turns)
  )

  const matcherRef = useRef<MapMatcher | null>(null)

  function logNavUpdate(navState: NavigationState) {
    const parts = [
      `[Nav] trackPt:${navState.currentIndex}`,
      `offTrack:${Math.round(navState.offTrackDistance)}m`,
      `remaining:${Math.round(navState.totalRemaining)}m`,
    ]
    if (navState.nextTurn && navState.distanceToNextTurn != null) {
      parts.push(`next:"${navState.nextTurn.text}" in ${Math.round(navState.distanceToNextTurn)}m`)
    }
    console.log(parts.join(' | '))
  }

  // Recreate map matcher when track changes
  useEffect(() => {
    const m = createMapMatcher(trackPoints, turns, DEFAULT_CONFIG)
    matcherRef.current = m
    if (trackPoints.length > 0) {
      setNavigationState(m.updatePosition(trackPoints[0][0], trackPoints[0][1]))
    }
  }, [trackPoints, turns])

  const setManualPosition = useCallback((lat: number, lon: number) => {
    const p: [number, number] = [lat, lon]
    setManualPositionState(p)
    if (matcherRef.current) {
      const navState = matcherRef.current.updatePosition(lat, lon)
      setNavigationState(navState)
      logNavUpdate(navState)
    }
  }, [])

  // GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setGpsPosition(p)
        setGpsAltitude(pos.coords.altitude)
        setHasGpsFix(true)
        if (manualPosition) return
        if (matcherRef.current) {
          const navState = matcherRef.current.updatePosition(p[0], p[1])
          setNavigationState(navState)
          logNavUpdate(navState)
        }
      },
      () => {
        setHasGpsFix(false)
      },
      { enableHighAccuracy: true }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [manualPosition])

  const effectivePosition = manualPosition ?? gpsPosition ?? (trackPoints[0] ?? [0, 0])

  return {
    position: effectivePosition,
    segmentIdx: navigationState.currentIndex,
    navigationState,
    altitude: gpsAltitude,
    isActive: hasGpsFix || manualPosition !== null,
    setManualPosition,
  }
}
