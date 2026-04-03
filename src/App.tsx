import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import gpxContent from './tracks/2026-04-03-demo.gpx?raw'
import { parseGpx } from './gpxParser'
import type { TurnInstruction } from './gpxParser'
import { MapView } from './MapView'

// Constants
const MIN_ZOOM = 10
const MAX_ZOOM = 17
const SLEEP_TIMEOUT = 3000

// Parse track from GPX file
const { trackPoints: GPX, turns: TURNS } = parseGpx(gpxContent)

// Helper
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function App() {
  // State
  const [zoom, setZoom] = useState(15)
  const [simIdx, setSimIdx] = useState(0)
  const [running, setRunning] = useState(false)
  const [followMode, setFollowMode] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [sleeping, setSleeping] = useState(false)
  const [walkedPath, setWalkedPath] = useState<[number, number][]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [haptic, setHaptic] = useState(false)

  // Simulation state for continuous movement
  const [segmentProgress, setSegmentProgress] = useState(0)
  const [currentPosition, setCurrentPosition] = useState<[number, number]>(GPX[0])

  // Refs
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const sleepTimerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  // Simulation state refs (for smooth updates)
  const simStateRef = useRef({
    segmentIdx: 0,
    progress: 0,
    lateralOffset: 0
  })

  // Get current instruction
  const currentInstruction = useCallback((): TurnInstruction => {
    return [...TURNS].reverse().find(t => t.idx <= simIdx) || TURNS[0]
  }, [simIdx])

  // Sleep/Wake functions
  const goToSleep = useCallback(() => {
    setSleeping(true)
  }, [])

  const wakeUp = useCallback((fromHaptic: boolean) => {
    setSleeping(false)
    if (fromHaptic) {
      setHaptic(true)
      setTimeout(() => setHaptic(false), 400)
    }
  }, [])

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
    }
    if (running) {
      sleepTimerRef.current = window.setTimeout(goToSleep, SLEEP_TIMEOUT)
    }
  }, [running, goToSleep])

  // Calculate position with deviation
  const calculateDeviatedPosition = useCallback((
    segmentIdx: number,
    progress: number,
    lateralOffsetMeters: number
  ): [number, number] => {
    if (segmentIdx >= GPX.length - 1) {
      return GPX[GPX.length - 1]
    }

    const start = GPX[segmentIdx]
    const end = GPX[segmentIdx + 1]

    const lat = start[0] + (end[0] - start[0]) * progress
    const lon = start[1] + (end[1] - start[1]) * progress

    const dLat = end[0] - start[0]
    const dLon = end[1] - start[1]
    const length = Math.sqrt(dLat * dLat + dLon * dLon)

    if (length > 0) {
      const perpLat = -dLon / length
      const perpLon = dLat / length
      const metersPerDegreeLat = 111000
      const metersPerDegreeLon = 71000
      const offsetLat = (perpLat * lateralOffsetMeters) / metersPerDegreeLat
      const offsetLon = (perpLon * lateralOffsetMeters) / metersPerDegreeLon
      return [lat + offsetLat, lon + offsetLon]
    }

    return [lat, lon]
  }, [])

  // Simulation control
  const toggleSim = useCallback(() => {
    if (!running) {
      setRunning(true)
      simStateRef.current = { segmentIdx: 0, progress: 0, lateralOffset: 0 }
      setSimIdx(0)
      setSegmentProgress(0)
      setCurrentPosition(GPX[0])
      setWalkedPath([GPX[0]])
      resetSleepTimer()
    } else {
      setRunning(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
      wakeUp(false)
    }
  }, [running, resetSleepTimer, wakeUp])

  const recenter = useCallback(() => {
    setFollowMode(true)
    setOffsetX(0)
    setOffsetY(0)
  }, [])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
    resetSleepTimer()
  }, [resetSleepTimer])

  // Event handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (sleeping) {
      wakeUp(false)
      return
    }
    e.preventDefault()
    changeZoom(e.deltaY < 0 ? 1 : -1)
  }, [sleeping, wakeUp, changeZoom])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (sleeping) return
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
    setFollowMode(false)
    resetSleepTimer()
  }, [sleeping, offsetX, offsetY, resetSleepTimer])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return
    setOffsetX(dragStartRef.current.ox - (e.clientX - dragStartRef.current.x))
    setOffsetY(dragStartRef.current.oy - (e.clientY - dragStartRef.current.y))
  }, [])

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null
  }, [])

  const handleSleepClick = useCallback(() => {
    wakeUp(false)
  }, [wakeUp])

  // Effects
  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulation interval - continuous movement
  useEffect(() => {
    if (running) {
      const STEP_SIZE = 0.04
      const INTERVAL_MS = 150
      const MAX_LATERAL_OFFSET = 8
      const OFFSET_CHANGE_RATE = 0.8

      intervalRef.current = window.setInterval(() => {
        const state = simStateRef.current

        const offsetChange = (Math.random() - 0.5) * OFFSET_CHANGE_RATE
        let newOffset = state.lateralOffset + offsetChange
        newOffset = Math.max(-MAX_LATERAL_OFFSET, Math.min(MAX_LATERAL_OFFSET, newOffset))

        let newProgress = state.progress + STEP_SIZE
        let newSegmentIdx = state.segmentIdx

        if (newProgress >= 1.0) {
          newSegmentIdx = state.segmentIdx + 1

          if (newSegmentIdx >= GPX.length - 1) {
            setRunning(false)
            return
          }

          newProgress = 0

          const instr = TURNS.find(t => t.idx === newSegmentIdx)
          if (instr) {
            wakeUp(true)
            resetSleepTimer()
          }
        }

        simStateRef.current = {
          segmentIdx: newSegmentIdx,
          progress: newProgress,
          lateralOffset: newOffset
        }

        const newPos = calculateDeviatedPosition(newSegmentIdx, newProgress, newOffset)

        setSimIdx(newSegmentIdx)
        setSegmentProgress(newProgress)
        setCurrentPosition(newPos)
        setWalkedPath(path => [...path, newPos])
        setFollowMode(true)
      }, INTERVAL_MS)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [running, wakeUp, resetSleepTimer, calculateDeviatedPosition])

  // Sleep timer effect
  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
    }
  }, [resetSleepTimer])

  const instr = currentInstruction()
  const distanceToNext = simIdx < GPX.length - 1
    ? Math.round(haversine(currentPosition, GPX[simIdx + 1]) * (1 - segmentProgress) +
        (simIdx < GPX.length - 2 ? haversine(GPX[simIdx + 1], GPX[simIdx + 2]) : 0) * segmentProgress)
    : 0

  return (
    <div className="app-container">
      <div className="bezel">
        <MapView
          zoom={zoom}
          currentPosition={currentPosition}
          followMode={followMode}
          offsetX={offsetX}
          offsetY={offsetY}
          trackPoints={GPX}
          walkedPath={walkedPath}
          sleeping={sleeping}
          haptic={haptic}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onSleepClick={handleSleepClick}
          currentTime={currentTime}
          navInstruction={{
            icon: instr.icon,
            text: instr.text,
            distText: `${distanceToNext}m zum nächsten Punkt`,
          }}
        />
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#3498db' }}></div>
          Track
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#e74c3c' }}></div>
          Gelaufen
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: 'transparent', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #007AFF' }}></div>
          Position
        </div>
      </div>

      <div className="controls">
        <button
          className="btn"
          style={{ background: running ? '#c0392b' : '#27ae60' }}
          onClick={toggleSim}
        >
          {running ? '⏸ Stop' : '▶ Simulation'}
        </button>
        <button className="btn" style={{ background: '#2980b9' }} onClick={recenter}>
          📍 Zentrieren
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(1)}>
          +
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(-1)}>
          −
        </button>
      </div>

      <div className="hint">
        Display schläft nach 3s ein · Antippen weckt auf · Bei Abbiegehinweis wacht es automatisch auf<br />
        Scroll = Zoom · Drag = Pan
      </div>
    </div>
  )
}

export default App
