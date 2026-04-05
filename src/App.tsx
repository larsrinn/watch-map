import { useState, useRef, useEffect } from 'react'
import './App.css'
import { MapView } from './MapView'
import { ControlScreen } from './components/ControlScreen'
import { TrackStatsScreen } from './components/TrackStatsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSleepWake } from './hooks/useSleepWake'
import { useMapInteraction } from './hooks/useMapInteraction'
import { useTrackRecording } from './hooks/useTrackRecording'
import { useScreenNavigation } from './hooks/useScreenNavigation'
import { useNavigation } from './hooks/useNavigation'

function App() {
  const [showTrackDots, setShowTrackDots] = useState(false)
  const [showTurnDots, setShowTurnDots] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { currentScreen, bezelRef, goToScreen, screenCount } = useScreenNavigation()

  const {
    gpxData, gpxFileName, preloadStatus,
    position, segmentIdx, altitude, isActive,
    navInstruction,
    handleGpxLoad: onGpxLoad,
  } = useNavigation()

  const { sleeping, haptic, wakeUp, resetSleepTimer } = useSleepWake(isActive)

  const {
    zoom, followMode, setFollowMode, offsetX, offsetY,
    recenter, changeZoom,
    handleWheel, handlePointerDown,
  } = useMapInteraction(sleeping, wakeUp, resetSleepTimer)

  const {
    isTracking, recordedPath,
    handleStartTrack, handleContinueTrack, handleStop, handleClear, handleExportGpx,
  } = useTrackRecording(position, altitude, isActive, setFollowMode)

  // Turn detection — wake + haptic when crossing a waypoint with a turn instruction
  const prevSegmentIdxRef = useRef(0)
  useEffect(() => {
    if (segmentIdx <= prevSegmentIdxRef.current) return
    prevSegmentIdxRef.current = segmentIdx
    const instr = gpxData?.turns.find(t => t.idx === segmentIdx)
    if (instr) {
      wakeUp(true)
      resetSleepTimer()
    }
  }, [segmentIdx, gpxData?.turns, wakeUp, resetSleepTimer])

  // Sleep timer
  useEffect(() => {
    resetSleepTimer()
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

  const handleSleepClick = () => wakeUp(false)

  const handleGpxLoad = (content: string, fileName: string) => {
    onGpxLoad(content, fileName)
    handleClear()
  }

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
              width: `${screenCount * 198}px`,
              transform: `translateX(${-currentScreen * 198}px)`,
            }}
          >
            <div className="screen-slide">
              <ControlScreen
                gpxFileName={gpxFileName}
                isTracking={isTracking}
                hasTrack={recordedPath.length > 0}
                onGpxLoad={handleGpxLoad}
                onStartTrack={() => handleStartTrack(() => goToScreen(1))}
                onContinueTrack={() => handleContinueTrack(() => goToScreen(1))}
                onStop={handleStop}
                onClear={handleClear}
                onExportGpx={handleExportGpx}
                preloadStatus={preloadStatus}
              />
            </div>
            <div className="screen-slide">
              <ErrorBoundary>
                <MapView
                  zoom={zoom}
                  currentPosition={position}
                  followMode={followMode}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  trackPoints={gpxData?.trackPoints ?? []}
                  recordedPath={recordedPath}
                  sleeping={sleeping}
                  onSleepClick={handleSleepClick}
                  currentTime={currentTime}
                  navInstruction={navInstruction}
                  showTrackDots={showTrackDots}
                  showTurnDots={showTurnDots}
                  turns={gpxData?.turns ?? []}
                />
              </ErrorBoundary>
            </div>
            <div className="screen-slide">
              <TrackStatsScreen
                recordedPath={recordedPath}
                isTracking={isTracking}
              />
            </div>
            <div className="screen-slide">
              <SettingsScreen
                showTrackDots={showTrackDots}
                showTurnDots={showTurnDots}
                onToggleTrackDots={() => setShowTrackDots(v => !v)}
                onToggleTurnDots={() => setShowTurnDots(v => !v)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="screen-dots">
        {Array.from({ length: screenCount }, (_, i) => (
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

      <div className="hint">
        Display schläft nach 3s ein · Antippen weckt auf · Bei Abbiegehinweis wacht es automatisch auf<br />
        Scroll = Zoom · Drag = Pan · ←→ Bildschirm wechseln
      </div>
    </div>
  )
}

export default App
