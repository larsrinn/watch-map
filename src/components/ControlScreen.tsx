import { useRef } from 'react'
import './ControlScreen.css'
import type { PreloadStatus } from '../tilePreloader'

interface ControlScreenProps {
  gpxFileName: string
  isTracking: boolean
  onGpxLoad: (content: string, fileName: string) => void
  onStartTrack: () => void
  onStopClear: () => void
  preloadStatus: PreloadStatus
}

export function ControlScreen({ gpxFileName, isTracking, onGpxLoad, onStartTrack, onStopClear, preloadStatus }: ControlScreenProps) {
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
    <div className="control-screen">
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
      <button
        className="btn control-btn"
        style={{ background: isTracking ? '#555' : '#27ae60' }}
        disabled={isTracking}
        onClick={onStartTrack}
      >
        {isTracking ? 'Tracking...' : 'Start Track'}
      </button>
      <button
        className="btn control-btn"
        style={{ background: isTracking ? '#c0392b' : '#555' }}
        onClick={onStopClear}
      >
        Stop / Clear
      </button>
    </div>
  )
}
