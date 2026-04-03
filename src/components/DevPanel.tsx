import { useState } from 'react'

interface DevPanelProps {
  isSimulating: boolean
  isPaused: boolean
  onStart: (durationSeconds: number) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function DevPanel({ isSimulating, isPaused, onStart, onPause, onResume, onStop }: DevPanelProps) {
  const [duration, setDuration] = useState(60)

  return (
    <div className="dev-panel">
      <span className="dev-label">DEV</span>
      <label>
        Sim duration (s):
        <input
          type="number"
          value={duration}
          min={5}
          max={600}
          onChange={e => setDuration(Number(e.target.value))}
          disabled={isSimulating || isPaused}
          className="dev-input"
        />
      </label>
      {!isSimulating && !isPaused && (
        <button className="btn" style={{ background: '#27ae60' }} onClick={() => onStart(duration)}>
          Start Sim
        </button>
      )}
      {isSimulating && (
        <>
          <button className="btn" style={{ background: '#e67e22' }} onClick={onPause}>
            Pause
          </button>
          <button className="btn" style={{ background: '#c0392b' }} onClick={onStop}>
            Stop
          </button>
        </>
      )}
      {isPaused && (
        <>
          <button className="btn" style={{ background: '#2980b9' }} onClick={onResume}>
            Resume
          </button>
          <button className="btn" style={{ background: '#c0392b' }} onClick={onStop}>
            Stop
          </button>
        </>
      )}
    </div>
  )
}
