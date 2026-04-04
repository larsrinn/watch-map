import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import gpxContent from './assets/2026-04-03-demo.gpx?raw'
import { parseGpx } from './gpxParser'
import type { ParsedGpx, TurnInstruction } from './gpxParser'
import { MapView } from './MapView'
import { usePosition } from './hooks/usePosition'
import { DevPanel } from './components/DevPanel'
import { ControlScreen } from './components/ControlScreen'
import { TrackStatsScreen } from './components/TrackStatsScreen'
import type { RecordedPoint } from './types'
import { preloadTiles } from './tilePreloader'
import type { PreloadStatus } from './tilePreloader'
import { exportGpx } from './gpxExport'

// Constants
const MIN_ZOOM = 10
const MAX_ZOOM = 17
const SLEEP_TIMEOUT = 3000
const SCREEN_COUNT = 3

// Helpers
function formatDistance(meters: number): string {
  if (meters < 100) {
    return `${Math.round(meters).toLocaleString()} m`
  } else if (meters < 300) {
    return `${(meters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
  } else {
    return `${(meters / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  }
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function App() {
  // Screen navigation
  const [currentScreen, setCurrentScreen] = useState(0)
  const bezelRef = useRef<HTMLDivElement>(null)
  const swipeTouchStartRef = useRef<{ x: number; y: number } | null>(null)

  // GPX state
  const [gpxData, setGpxData] = useState<ParsedGpx>(() => parseGpx(gpxContent))
  const [gpxFileName, setGpxFileName] = useState('2026-04-03-demo.gpx')
  const [isTracking, setIsTracking] = useState(false)
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({ phase: 'idle' })
  const preloadAbortRef = useRef<AbortController | null>(null)

  // Map state
  const [zoom, setZoom] = useState(15)
  const [followMode, setFollowMode] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [sleeping, setSleeping] = useState(false)
  const [walkedPath, setWalkedPath] = useState<RecordedPoint[]>(() => {
    try {
      const saved = localStorage.getItem('watch-nav-track')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [haptic, setHaptic] = useState(false)

  // Position (real GPS or simulation)
  const { position, segmentIdx, altitude, isActive, isSimulating, isSimPaused,
          startSimulation, pauseSimulation, resumeSimulation, stopSimulation } = usePosition(gpxData.trackPoints)

  // Refs
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const sleepTimerRef = useRef<number | null>(null)
  const prevSegmentIdxRef = useRef(0)

  // Get current instruction
  const currentInstruction = useCallback((): TurnInstruction => {
    return gpxData.turns.find(t => t.idx > segmentIdx) ?? gpxData.turns[gpxData.turns.length - 1]
  }, [segmentIdx, gpxData.turns])

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

  // GPX and track control
  const handleGpxLoad = useCallback((content: string, fileName: string) => {
    const parsed = parseGpx(content)
    setGpxData(parsed)
    setGpxFileName(fileName)
    setIsTracking(false)
    setWalkedPath([])
    localStorage.removeItem('watch-nav-track')

    preloadAbortRef.current?.abort()
    const controller = new AbortController()
    preloadAbortRef.current = controller
    setPreloadStatus({ phase: 'running', done: 0, total: 0 })
    preloadTiles(
      parsed.trackPoints,
      (done, total) => setPreloadStatus({ phase: 'running', done, total }),
      controller.signal,
    ).then(({ cached }) => {
      setPreloadStatus({ phase: 'done', cached })
    }).catch((err: unknown) => {
      if ((err as Error)?.name !== 'AbortError') setPreloadStatus({ phase: 'error' })
    })
  }, [])

  const handleStartTrack = useCallback(() => {
    setIsTracking(true)
    setWalkedPath([])
    setCurrentScreen(1)
  }, [])

  const handleStop = useCallback(() => {
    setIsTracking(false)
    stopSimulation()
  }, [stopSimulation])

  const handleClear = useCallback(() => {
    setWalkedPath([])
    localStorage.removeItem('watch-nav-track')
  }, [])

  const handleExportGpx = useCallback(() => {
    if (walkedPath.length === 0) return
    const content = exportGpx(walkedPath)
    const fileName = `track-${new Date().toISOString().slice(0, 10)}.gpx`
    const blob = new Blob([content], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [walkedPath])

  const handleStartSimulation = useCallback((duration: number) => {
    setIsTracking(true)
    setWalkedPath([])
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

  // Keyboard navigation between screens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrentScreen(s => Math.min(s + 1, SCREEN_COUNT - 1))
      if (e.key === 'ArrowLeft') setCurrentScreen(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Touch swipe navigation between screens
  useEffect(() => {
    const bezel = bezelRef.current
    if (!bezel) return

    const handleTouchStart = (e: TouchEvent) => {
      swipeTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!swipeTouchStartRef.current) return
      const dx = e.changedTouches[0].clientX - swipeTouchStartRef.current.x
      const dy = e.changedTouches[0].clientY - swipeTouchStartRef.current.y
      swipeTouchStartRef.current = null
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) setCurrentScreen(s => Math.min(s + 1, SCREEN_COUNT - 1))
      else setCurrentScreen(s => Math.max(s - 1, 0))
    }

    bezel.addEventListener('touchstart', handleTouchStart)
    bezel.addEventListener('touchend', handleTouchEnd)
    return () => {
      bezel.removeEventListener('touchstart', handleTouchStart)
      bezel.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Accumulate walked path when tracking is active
  useEffect(() => {
    if (!isActive || !isTracking) return
    setWalkedPath(path => [...path, { lat: position[0], lon: position[1], alt: altitude, ts: Date.now() }])
    setFollowMode(true)
  }, [position, isActive, isTracking])

  // Persist walked path to localStorage
  useEffect(() => {
    if (walkedPath.length > 0) {
      localStorage.setItem('watch-nav-track', JSON.stringify(walkedPath))
    }
  }, [walkedPath])

  // Turn detection — wake + haptic when crossing a waypoint with a turn instruction
  useEffect(() => {
    if (segmentIdx <= prevSegmentIdxRef.current) return
    prevSegmentIdxRef.current = segmentIdx
    const instr = gpxData.turns.find(t => t.idx === segmentIdx)
    if (instr) {
      wakeUp(true)
      resetSleepTimer()
    }
  }, [segmentIdx, gpxData.turns, wakeUp, resetSleepTimer])

  // Sleep timer
  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
    }
  }, [resetSleepTimer])

  // Screen Wake Lock — prevent phone screen from locking while tracking
  useEffect(() => {
    if (!isTracking || !('wakeLock' in navigator)) return
    let wakeLock: WakeLockSentinel | null = null

    const acquire = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen')
      } catch {
        // silently ignore — e.g. battery saver mode
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      wakeLock?.release()
    }
  }, [isTracking])

  const instr = currentInstruction()
  const nextPtIdx = Math.min(segmentIdx + 1, gpxData.trackPoints.length - 1)
  const distanceToNext = Math.round(haversine(position, gpxData.trackPoints[nextPtIdx]) + gpxData.distToNextTurn[nextPtIdx])

  return (
    <div className="app-container">
      <div className="bezel" ref={bezelRef}>
        <div
          className={`watch ${haptic ? 'haptic' : ''} ${currentScreen === 1 ? 'map-active' : ''} ${currentScreen === 1 && sleeping ? 'sleeping' : ''}`}
          onWheel={currentScreen === 1 ? handleWheel : undefined}
          onPointerDown={currentScreen === 1 ? handlePointerDown : undefined}
        >
          <div
            className="screen-strip"
            style={{
              width: `${SCREEN_COUNT * 198}px`,
              transform: `translateX(${-currentScreen * 198}px)`,
            }}
          >
            <div className="screen-slide">
              <ControlScreen
                gpxFileName={gpxFileName}
                isTracking={isTracking}
                hasTrack={walkedPath.length > 0}
                onGpxLoad={handleGpxLoad}
                onStartTrack={handleStartTrack}
                onStop={handleStop}
                onClear={handleClear}
                onExportGpx={handleExportGpx}
                preloadStatus={preloadStatus}
              />
            </div>
            <div className="screen-slide">
              <MapView
                zoom={zoom}
                currentPosition={position}
                followMode={followMode}
                offsetX={offsetX}
                offsetY={offsetY}
                trackPoints={gpxData.trackPoints}
                walkedPath={walkedPath}
                sleeping={sleeping}
                onSleepClick={handleSleepClick}
                currentTime={currentTime}
                navInstruction={{
                  icon: instr.icon,
                  text: instr.text,
                  distText: formatDistance(distanceToNext),
                }}
              />
            </div>
            <div className="screen-slide">
              <TrackStatsScreen
                walkedPath={walkedPath}
                isTracking={isTracking}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="screen-dots">
        {Array.from({ length: SCREEN_COUNT }, (_, i) => (
          <div key={i} className={`dot${i === currentScreen ? ' dot-active' : ''}`} />
        ))}
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
        Scroll = Zoom · Drag = Pan · ←→ Bildschirm wechseln
      </div>
    </div>
  )
}

export default App
