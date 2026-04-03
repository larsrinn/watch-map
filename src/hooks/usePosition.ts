import { useState, useEffect } from 'react'
import { useSimulation } from './useSimulation'

function nearestSegmentIdx(
  trackPoints: [number, number][],
  position: [number, number]
): number {
  let minDist = Infinity
  let nearest = 0
  for (let i = 0; i < trackPoints.length; i++) {
    const dLat = trackPoints[i][0] - position[0]
    const dLon = trackPoints[i][1] - position[1]
    const dist = dLat * dLat + dLon * dLon
    if (dist < minDist) {
      minDist = dist
      nearest = i
    }
  }
  return nearest
}

export function usePosition(trackPoints: [number, number][]): {
  position: [number, number]
  segmentIdx: number
  segmentProgress: number
  isActive: boolean
  isSimulating: boolean
  isSimPaused: boolean
  startSimulation: (durationSeconds: number) => void
  pauseSimulation: () => void
  resumeSimulation: () => void
  stopSimulation: () => void
} {
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null)
  const [gpsSegmentIdx, setGpsSegmentIdx] = useState(0)
  const [hasGpsFix, setHasGpsFix] = useState(false)

  const sim = useSimulation(trackPoints)

  const simActive = import.meta.env.DEV && (sim.isRunning || sim.isPaused)

  useEffect(() => {
    if (!navigator.geolocation) return
    if (simActive) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setGpsPosition(p)
        setGpsSegmentIdx(nearestSegmentIdx(trackPoints, p))
        setHasGpsFix(true)
      },
      () => {
        setHasGpsFix(false)
      },
      { enableHighAccuracy: true }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [trackPoints, simActive])

  if (simActive) {
    return {
      position: sim.position,
      segmentIdx: sim.segmentIdx,
      segmentProgress: sim.segmentProgress,
      isActive: true,
      isSimulating: sim.isRunning,
      isSimPaused: sim.isPaused,
      startSimulation: sim.start,
      pauseSimulation: sim.pause,
      resumeSimulation: sim.resume,
      stopSimulation: sim.stop,
    }
  }

  return {
    position: gpsPosition ?? trackPoints[0],
    segmentIdx: gpsSegmentIdx,
    segmentProgress: 0,
    isActive: hasGpsFix,
    isSimulating: false,
    isSimPaused: false,
    startSimulation: import.meta.env.DEV ? sim.start : () => {},
    pauseSimulation: import.meta.env.DEV ? sim.pause : () => {},
    resumeSimulation: import.meta.env.DEV ? sim.resume : () => {},
    stopSimulation: import.meta.env.DEV ? sim.stop : () => {},
  }
}
