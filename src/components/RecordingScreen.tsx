import './ControlScreen.css'
import { Button } from './Button'

interface RecordingScreenProps {
  isTracking: boolean
  hasTrack: boolean
  onStartTrack: () => void
  onContinueTrack: () => void
  onStop: () => void
  onClear: () => void
  onExportGpx: () => void
}

export function RecordingScreen({ isTracking, hasTrack, onStartTrack, onContinueTrack, onStop, onClear, onExportGpx }: RecordingScreenProps) {
  return (
    <div className={`control-screen${hasTrack && !isTracking ? ' control-screen--has-track' : ''}`}>
      <div className="screen-title">Aufzeichnung</div>
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
          <Button variant="danger" className="control-btn" onClick={onClear}>
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
