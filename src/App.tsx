import { useState, useRef, useEffect } from 'react'
import './App.css'
import { MapView } from './MapView'
import { RouteScreen } from './components/RouteScreen'
import { RecordingScreen } from './components/RecordingScreen'
import { TrackStatsScreen } from './components/TrackStatsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Button } from './components/Button'
import { useSleepWake } from './hooks/useSleepWake'
import { useMapInteraction } from './hooks/useMapInteraction'
import { useTrackRecording } from './hooks/useTrackRecording'
import { useScreenNavigation } from './hooks/useScreenNavigation'
import { useNavigation } from './hooks/useNavigation'
import { useAlarms } from './hooks/useAlarms'
import { useScreenLock } from './hooks/useScreenLock'
import { useSettings } from './hooks/useSettings'

function App() {
  const { settings, update, toggle } = useSettings()
  const [turnAlarmTrigger, setTurnAlarmTrigger] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { locked, unlockProgress, handleLockPointerDown, handleLockPointerUp } = useScreenLock()

  const { currentScreen, bezelRef, goToScreen, screenCount } = useScreenNavigation(locked)

  const {
    gpxData, gpxFileName, preloadStatus,
    position, segmentIdx, navigationState, altitude, isActive,
    navInstruction,
    handleGpxLoad,
    handleGpxUnload,
    setManualPosition,
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
      setTurnAlarmTrigger(c => c + 1)
    }
  }, [segmentIdx, gpxData?.turns, wakeUp, resetSleepTimer])

  useAlarms({
    turnAlarmEnabled: settings.turnAlarmEnabled,
    offTrackAlarmEnabled: settings.offTrackAlarmEnabled,
    offTrackThreshold: settings.offTrackThreshold,
    offTrackDistance: navigationState.offTrackDistance,
    turnAlarmTrigger,
  })

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

  return (
    <div className="app-container">
      <div className="bezel" ref={bezelRef}>
        <div
          className={`watch ${haptic ? 'haptic' : ''} ${currentScreen === 2 ? 'map-active' : ''} ${currentScreen === 2 && sleeping ? 'sleeping' : ''}`}
          onWheel={currentScreen === 2 ? handleWheel : undefined}
          onPointerDown={currentScreen === 2 ? handlePointerDown : undefined}
        >
          <div
            className="screen-strip"
            style={{
              width: `${screenCount * 198}px`,
              transform: `translateX(${-currentScreen * 198}px)`,
            }}
          >
            <div className="screen-slide">
              <RouteScreen
                gpxFileName={gpxFileName}
                hasGpx={gpxData !== null}
                onGpxLoad={handleGpxLoad}
                onGpxUnload={handleGpxUnload}
                preloadStatus={preloadStatus}
              />
            </div>
            <div className="screen-slide">
              <RecordingScreen
                isTracking={isTracking}
                hasTrack={recordedPath.length > 0}
                onStartTrack={() => handleStartTrack(() => goToScreen(2))}
                onContinueTrack={() => handleContinueTrack(() => goToScreen(2))}
                onStop={handleStop}
                onClear={handleClear}
                onExportGpx={handleExportGpx}
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
                  navInstruction={settings.showInstructions ? navInstruction : null}
                  showTrackDots={settings.showTrackDots}
                  showTurnDots={settings.showTurnDots}
                  turns={gpxData?.turns ?? []}
                  onSetManualPosition={import.meta.env.DEV ? setManualPosition : undefined}
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
                showTrackDots={settings.showTrackDots}
                showTurnDots={settings.showTurnDots}
                onToggleTrackDots={() => toggle('showTrackDots')}
                onToggleTurnDots={() => toggle('showTurnDots')}
                turnAlarmEnabled={settings.turnAlarmEnabled}
                offTrackAlarmEnabled={settings.offTrackAlarmEnabled}
                offTrackThreshold={settings.offTrackThreshold}
                onToggleTurnAlarm={() => toggle('turnAlarmEnabled')}
                onToggleOffTrackAlarm={() => toggle('offTrackAlarmEnabled')}
                onChangeOffTrackThreshold={(v) => update('offTrackThreshold', Math.max(10, Math.min(100, v)))}
                showInstructions={settings.showInstructions}
                onToggleInstructions={() => toggle('showInstructions')}
              />
            </div>
          </div>
          {locked && <div className="lock-overlay" />}
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
          Strecke
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
        <Button variant="primary" onClick={recenter}>
          Zentrieren
        </Button>
        <Button variant="neutral" onClick={() => changeZoom(1)}>
          +
        </Button>
        <Button variant="neutral" onClick={() => changeZoom(-1)}>
          −
        </Button>
        <Button
          variant="neutral"
          className="lock-btn"
          style={locked && unlockProgress > 0 ? {
            background: `linear-gradient(to right, #27ae60 ${unlockProgress * 100}%, #555 ${unlockProgress * 100}%)`,
          } : locked ? { background: '#c0392b' } : undefined}
          onPointerDown={handleLockPointerDown}
          onPointerUp={handleLockPointerUp}
          onPointerLeave={handleLockPointerUp}
        >
          {locked ? '🔒' : '🔓'}
        </Button>
      </div>

      <div className="hint">
        Display schläft nach 3s ein · Antippen weckt auf · Bei Abbiegehinweis wacht es automatisch auf<br />
        Scroll = Zoom · Drag = Pan · ←→ Bildschirm wechseln
      </div>
    </div>
  )
}

export default App
