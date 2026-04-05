import { useRef } from 'react'
import './ControlScreen.css'
import { Button } from './Button'
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
      if (total === 0) return <div className="preload-status">Wird gecacht&hellip;</div>
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
      return <div className="preload-status done">&#10003; Offline bereit ({preloadStatus.cached})</div>
    }
    return <div className="preload-status error">Cache fehlgeschlagen</div>
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
      <Button variant="primary" className="control-btn" onClick={() => fileInputRef.current?.click()}>
        GPX laden
      </Button>
      {isTracking ? (
        <>
          <Button variant="neutral" className="control-btn" disabled>
            Aufzeichnung...
          </Button>
          <Button variant="danger" className="control-btn" onClick={onStop}>
            Stopp
          </Button>
        </>
      ) : hasTrack ? (
        <>
          <Button variant="success" className="control-btn" onClick={onContinueTrack}>
            Fortsetzen
          </Button>
          <Button variant="neutral" className="control-btn" onClick={onStartTrack}>
            Neuer Track
          </Button>
          <Button variant="neutral" className="control-btn" onClick={onClear}>
            Löschen
          </Button>
          <Button variant="primary" className="control-btn" onClick={onExportGpx}>
            GPX Export
          </Button>
        </>
      ) : (
        <>
          <Button variant="success" className="control-btn" onClick={onStartTrack}>
            Track starten
          </Button>
          <Button variant="neutral" className="control-btn" disabled>
            Stopp
          </Button>
        </>
      )}
    </div>
  )
}
