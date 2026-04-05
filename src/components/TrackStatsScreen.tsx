import './TrackStatsScreen.css'
import type { RecordedPoint } from '../types'
import { haversine, formatDistance } from '../geo'

interface TrackStatsScreenProps {
  walkedPath: RecordedPoint[]
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

export function TrackStatsScreen({ walkedPath, isTracking }: TrackStatsScreenProps) {
  if (walkedPath.length === 0) {
    return (
      <div className="stats-screen">
        <div className="stats-empty">
          {isTracking ? 'Warte auf GPS...' : 'Kein Track'}
        </div>
      </div>
    )
  }

  const first = walkedPath[0]
  const last = walkedPath[walkedPath.length - 1]

  const distance = walkedPath.reduce((sum, pt, i) => {
    if (i === 0) return 0
    const prev = walkedPath[i - 1]
    return sum + haversine([prev.lat, prev.lon], [pt.lat, pt.lon])
  }, 0)

  const duration = last.ts - first.ts

  let elevGain: number | null = null
  const hasAlt = walkedPath.some(p => p.alt !== null)
  if (hasAlt) {
    elevGain = 0
    for (let i = 1; i < walkedPath.length; i++) {
      const prev = walkedPath[i - 1]
      const cur = walkedPath[i]
      if (prev.alt !== null && cur.alt !== null && cur.alt > prev.alt) {
        elevGain += cur.alt - prev.alt
      }
    }
  }

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
