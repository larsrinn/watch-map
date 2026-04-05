import { useState, useEffect, useRef } from 'react'
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
} {
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null)
  const [gpsAltitude, setGpsAltitude] = useState<number | null>(null)
  const [hasGpsFix, setHasGpsFix] = useState(false)
  const [navigationState, setNavigationState] = useState<NavigationState>(
    () => makeInitialNavState(trackPoints, turns)
  )

  const matcherRef = useRef<MapMatcher | null>(null)

  // Recreate map matcher when track changes
  useEffect(() => {
    const m = createMapMatcher(trackPoints, turns, DEFAULT_CONFIG)
    matcherRef.current = m
    if (trackPoints.length > 0) {
      setNavigationState(m.updatePosition(trackPoints[0][0], trackPoints[0][1]))
    }
  }, [trackPoints, turns])

  // GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setGpsPosition(p)
        setGpsAltitude(pos.coords.altitude)
        setHasGpsFix(true)
        if (matcherRef.current) {
          setNavigationState(matcherRef.current.updatePosition(p[0], p[1]))
        }
      },
      () => {
        setHasGpsFix(false)
      },
      { enableHighAccuracy: true }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return {
    position: gpsPosition ?? (trackPoints[0] ?? [0, 0]),
    segmentIdx: navigationState.currentIndex,
    navigationState,
    altitude: gpsAltitude,
    isActive: hasGpsFix,
  }
}
