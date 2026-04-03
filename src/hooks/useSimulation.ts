import { useState, useRef, useEffect, useCallback } from 'react'

const INTERVAL_MS = 150
const MAX_LATERAL_OFFSET = 8
const OFFSET_CHANGE_RATE = 0.8

function calculateDeviatedPosition(
  trackPoints: [number, number][],
  segmentIdx: number,
  progress: number,
  lateralOffsetMeters: number
): [number, number] {
  if (segmentIdx >= trackPoints.length - 1) {
    return trackPoints[trackPoints.length - 1]
  }

  const start = trackPoints[segmentIdx]
  const end = trackPoints[segmentIdx + 1]

  const lat = start[0] + (end[0] - start[0]) * progress
  const lon = start[1] + (end[1] - start[1]) * progress

  const dLat = end[0] - start[0]
  const dLon = end[1] - start[1]
  const length = Math.sqrt(dLat * dLat + dLon * dLon)

  if (length > 0) {
    const perpLat = -dLon / length
    const perpLon = dLat / length
    const offsetLat = (perpLat * lateralOffsetMeters) / 111000
    const offsetLon = (perpLon * lateralOffsetMeters) / 71000
    return [lat + offsetLat, lon + offsetLon]
  }

  return [lat, lon]
}

export function useSimulation(trackPoints: [number, number][]): {
  position: [number, number]
  segmentIdx: number
  segmentProgress: number
  isRunning: boolean
  isPaused: boolean
  start: (durationSeconds: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
} {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [position, setPosition] = useState<[number, number]>(trackPoints[0])
  const [segmentIdx, setSegmentIdx] = useState(0)
  const [segmentProgress, setSegmentProgress] = useState(0)

  const simStateRef = useRef({ segmentIdx: 0, progress: 0, lateralOffset: 0 })
  const durationRef = useRef(60)

  const start = useCallback((durationSeconds: number) => {
    durationRef.current = durationSeconds
    simStateRef.current = { segmentIdx: 0, progress: 0, lateralOffset: 0 }
    setSegmentIdx(0)
    setSegmentProgress(0)
    setPosition(trackPoints[0])
    setIsPaused(false)
    setIsRunning(true)
  }, [trackPoints])

  const pause = useCallback(() => {
    setIsRunning(false)
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    setIsPaused(false)
  }, [])

  useEffect(() => {
    if (!isRunning) return

    const stepSize = (trackPoints.length - 1) * INTERVAL_MS / (durationRef.current * 1000)

    const intervalId = window.setInterval(() => {
      const state = simStateRef.current

      const offsetChange = (Math.random() - 0.5) * OFFSET_CHANGE_RATE
      let newOffset = state.lateralOffset + offsetChange
      newOffset = Math.max(-MAX_LATERAL_OFFSET, Math.min(MAX_LATERAL_OFFSET, newOffset))

      let newProgress = state.progress + stepSize
      let newSegmentIdx = state.segmentIdx

      if (newProgress >= 1.0) {
        newSegmentIdx = state.segmentIdx + 1

        if (newSegmentIdx >= trackPoints.length - 1) {
          setIsRunning(false)
          return
        }

        newProgress = 0
      }

      simStateRef.current = { segmentIdx: newSegmentIdx, progress: newProgress, lateralOffset: newOffset }

      const newPos = calculateDeviatedPosition(trackPoints, newSegmentIdx, newProgress, newOffset)
      setSegmentIdx(newSegmentIdx)
      setSegmentProgress(newProgress)
      setPosition(newPos)
    }, INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isRunning, trackPoints])

  return { position, segmentIdx, segmentProgress, isRunning, isPaused, start, pause, resume, stop }
}
