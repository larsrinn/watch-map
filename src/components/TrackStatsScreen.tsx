import './TrackStatsScreen.css'
import type { RecordedPoint } from '../types'
import { haversine, formatDistance, elevationGain } from '../geo'

interface TrackStatsScreenProps {
  recordedPath: RecordedPoint[]
  isTracking: boolean
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function TrackStatsScreen({ recordedPath, isTracking }: TrackStatsScreenProps) {
  if (recordedPath.length === 0) {
    return (
      <div className="stats-screen">
        <div className="stats-empty">
          {isTracking ? 'Warte auf GPS...' : 'Kein Track'}
        </div>
      </div>
    )
  }

  const first = recordedPath[0]
  const last = recordedPath[recordedPath.length - 1]

  const distance = recordedPath.reduce((sum, pt, i) => {
    if (i === 0) return 0
    const prev = recordedPath[i - 1]
    return sum + haversine([prev.lat, prev.lon], [pt.lat, pt.lon])
  }, 0)

  const duration = last.ts - first.ts

  const hasAlt = recordedPath.some(p => p.alt !== null)
  const elevGain = hasAlt ? elevationGain(recordedPath.map(p => p.alt)) : null

  return (
    <div className="stats-screen">
      <div className="stats-row">
        <div className="stats-label">Start</div>
        <div className="stats-value">{formatTime(first.ts)}</div>
      </div>
      <div className="stats-row">
        <div className="stats-label">Zeit</div>
        <div className="stats-value">{formatDuration(duration)}</div>
      </div>
      <div className="stats-row">
        <div className="stats-label">Distanz</div>
        <div className="stats-value">{formatDistance(distance)}</div>
      </div>
      {elevGain !== null && (
        <div className="stats-row">
          <div className="stats-label">Aufstieg</div>
          <div className="stats-value">+{Math.round(elevGain)} m</div>
        </div>
      )}
    </div>
  )
}
