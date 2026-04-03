import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import gpxContent from './assets/2026-04-03-demo.gpx?raw'
import { parseGpx } from './gpxParser'
import type { TurnInstruction } from './gpxParser'
import { MapView } from './MapView'
import { usePosition } from './hooks/usePosition'
import { DevPanel } from './components/DevPanel'

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
  const [followMode, setFollowMode] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [sleeping, setSleeping] = useState(false)
  const [walkedPath, setWalkedPath] = useState<[number, number][]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [haptic, setHaptic] = useState(false)

  // Position (real GPS or simulation)
  const { position, segmentIdx, segmentProgress, isActive, isSimulating, isSimPaused,
          startSimulation, pauseSimulation, resumeSimulation, stopSimulation } = usePosition(GPX)

  // Refs
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const sleepTimerRef = useRef<number | null>(null)
  const prevSegmentIdxRef = useRef(0)

  // Get current instruction
  const currentInstruction = useCallback((): TurnInstruction => {
    return [...TURNS].reverse().find(t => t.idx <= segmentIdx) || TURNS[0]
  }, [segmentIdx])

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
    if (isActive) {
      sleepTimerRef.current = window.setTimeout(goToSleep, SLEEP_TIMEOUT)
    }
  }, [isActive, goToSleep])

  const recenter = useCallback(() => {
    setFollowMode(true)
    setOffsetX(0)
    setOffsetY(0)
  }, [])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
    resetSleepTimer()
  }, [resetSleepTimer])

  const handleStartSimulation = useCallback((duration: number) => {
    setWalkedPath([GPX[0]])
    startSimulation(duration)
  }, [startSimulation])

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

  // Accumulate walked path and stay centered when position is active
  useEffect(() => {
    if (!isActive) return
    setWalkedPath(path => [...path, position])
    setFollowMode(true)
  }, [position, isActive])

  // Turn detection — wake + haptic when crossing a waypoint with a turn instruction
  useEffect(() => {
    if (segmentIdx <= prevSegmentIdxRef.current) return
    prevSegmentIdxRef.current = segmentIdx
    const instr = TURNS.find(t => t.idx === segmentIdx)
    if (instr) {
      wakeUp(true)
      resetSleepTimer()
    }
  }, [segmentIdx, wakeUp, resetSleepTimer])

  // Sleep timer
  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
    }
  }, [resetSleepTimer])

  const instr = currentInstruction()
  const distanceToNext = segmentIdx < GPX.length - 1
    ? Math.round(haversine(position, GPX[segmentIdx + 1]) * (1 - segmentProgress) +
        (segmentIdx < GPX.length - 2 ? haversine(GPX[segmentIdx + 1], GPX[segmentIdx + 2]) : 0) * segmentProgress)
    : 0

  return (
    <div className="app-container">
      <div className="bezel">
        <MapView
          zoom={zoom}
          currentPosition={position}
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
        <button className="btn" style={{ background: '#2980b9' }} onClick={recenter}>
          Zentrieren
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(1)}>
          +
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(-1)}>
          −
        </button>
      </div>

      {import.meta.env.DEV && (
        <DevPanel
          isSimulating={isSimulating}
          isPaused={isSimPaused}
          onStart={handleStartSimulation}
          onPause={pauseSimulation}
          onResume={resumeSimulation}
          onStop={stopSimulation}
        />
      )}

      <div className="hint">
        Display schläft nach 3s ein · Antippen weckt auf · Bei Abbiegehinweis wacht es automatisch auf<br />
        Scroll = Zoom · Drag = Pan
      </div>
    </div>
  )
}

export default App
