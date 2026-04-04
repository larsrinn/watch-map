import { useRef } from 'react'
import './ControlScreen.css'

interface ControlScreenProps {
  gpxFileName: string
  isTracking: boolean
  onGpxLoad: (content: string, fileName: string) => void
  onStartTrack: () => void
  onStopClear: () => void
}

export function ControlScreen({ gpxFileName, isTracking, onGpxLoad, onStartTrack, onStopClear }: ControlScreenProps) {
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

  return (
    <div className="control-screen">
      <div className="control-filename">{gpxFileName}</div>
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
