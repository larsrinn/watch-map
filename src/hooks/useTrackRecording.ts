import { useState, useRef, useEffect, useCallback } from 'react'
import type { RecordedPoint } from '../types'
import { shouldRecordPoint } from '../geo'
import { exportGpx } from '../gpxExport'

const MIN_RECORD_DISTANCE = 5 // meters — skip GPS fixes closer than this
const PERSIST_INTERVAL = 30_000 // ms — debounce localStorage writes
const STORAGE_KEY = 'watch-nav-track'

export function useTrackRecording(
  position: [number, number],
  altitude: number | null,
  isActive: boolean,
  setFollowMode: (v: boolean) => void,
) {
  const [isTracking, setIsTracking] = useState(false)
  const [recordedPath, setRecordedPath] = useState<RecordedPoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  // Accumulate recorded path when tracking is active (min-distance filter)
  useEffect(() => {
    if (!isActive || !isTracking) return
    setRecordedPath(path => {
      const last = path[path.length - 1]
      if (!shouldRecordPoint(last ? [last.lat, last.lon] : null, position, MIN_RECORD_DISTANCE)) return path
      return [...path, { lat: position[0], lon: position[1], alt: altitude, ts: Date.now() }]
    })
    setFollowMode(true)
  }, [position, isActive, isTracking, altitude, setFollowMode])

  // Persist recorded path to localStorage (debounced + flush on unload)
  const recordedPathRef = useRef(recordedPath)
  useEffect(() => {
    recordedPathRef.current = recordedPath
  }, [recordedPath])

  useEffect(() => {
    const flush = () => {
      if (recordedPathRef.current.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recordedPathRef.current))
      }
    }
    const timer = setInterval(flush, PERSIST_INTERVAL)
    window.addEventListener('beforeunload', flush)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [])

  const handleStartTrack = useCallback((goToMap: () => void) => {
    setIsTracking(true)
    setRecordedPath([])
    localStorage.removeItem(STORAGE_KEY)
    goToMap()
  }, [])

  const handleContinueTrack = useCallback((goToMap: () => void) => {
    setIsTracking(true)
    goToMap()
  }, [])

  const handleStop = useCallback(() => {
    setIsTracking(false)
  }, [])

  const handleClear = useCallback(() => {
    setRecordedPath([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleExportGpx = useCallback(() => {
    if (recordedPath.length === 0) return
    const content = exportGpx(recordedPath)
    const fileName = `track-${new Date().toISOString().slice(0, 10)}.gpx`
    const blob = new Blob([content], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [recordedPath])

  return {
    isTracking, recordedPath, setRecordedPath,
    handleStartTrack, handleContinueTrack, handleStop, handleClear, handleExportGpx,
  }
}
