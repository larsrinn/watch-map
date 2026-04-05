import { useRef } from 'react'
import './ControlScreen.css'
import type { PreloadStatus } from '../tilePreloader'

interface ControlScreenProps {
  gpxFileName: string
  isTracking: boolean
  hasTrack: boolean
  onGpxLoad: (content: string, fileName: string) => void
  onStartTrack: () => void
  onContinueTrack: () => void
  onStop: () => void
  onClear: () => void
  onExportGpx: () => void
  preloadStatus: PreloadStatus
}

export function ControlScreen({ gpxFileName, isTracking, hasTrack, onGpxLoad, onStartTrack, onContinueTrack, onStop, onClear, onExportGpx, preloadStatus }: ControlScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      onGpxLoad(content, file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const statusEl = (() => {
    if (preloadStatus.phase === 'idle') return null
    if (preloadStatus.phase === 'running') {
      const { done, total } = preloadStatus
      if (total === 0) return <div className="preload-status">Caching&hellip;</div>
      const pct = Math.round((done / total) * 100)
      return (
        <div className="preload-status">
          <div className="preload-bar-track">
            <div className="preload-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          {done}/{total}
        </div>
      )
    }
    if (preloadStatus.phase === 'done') {
      return <div className="preload-status done">&#10003; Offline ready ({preloadStatus.cached})</div>
    }
    return <div className="preload-status error">Cache failed</div>
  })()

  return (
    <div className={`control-screen${hasTrack && !isTracking ? ' control-screen--has-track' : ''}`}>
      <div className="control-filename">{gpxFileName}</div>
      {statusEl}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button className="btn control-btn" style={{ background: '#2980b9' }} onClick={() => fileInputRef.current?.click()}>
        Pick GPX
      </button>
      {isTracking ? (
        <>
          <button className="btn control-btn" style={{ background: '#555' }} disabled>
            Tracking...
          </button>
          <button className="btn control-btn" style={{ background: '#c0392b' }} onClick={onStop}>
            Stop
          </button>
        </>
      ) : hasTrack ? (
        <>
          <button className="btn control-btn" style={{ background: '#27ae60' }} onClick={onContinueTrack}>
            Continue
          </button>
          <button className="btn control-btn" style={{ background: '#555' }} onClick={onStartTrack}>
            New Track
          </button>
          <button className="btn control-btn" style={{ background: '#555' }} onClick={onClear}>
            Clear
          </button>
          <button className="btn control-btn" style={{ background: '#2980b9' }} onClick={onExportGpx}>
            Export GPX
          </button>
        </>
      ) : (
        <>
          <button className="btn control-btn" style={{ background: '#27ae60' }} onClick={onStartTrack}>
            Start Track
          </button>
          <button className="btn control-btn" style={{ background: '#555' }} disabled>
            Stop
          </button>
        </>
      )}
    </div>
  )
}
