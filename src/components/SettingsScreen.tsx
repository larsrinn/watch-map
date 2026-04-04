import './SettingsScreen.css'

interface SettingsScreenProps {
  showTrackDots: boolean
  showTurnDots: boolean
  onToggleTrackDots: () => void
  onToggleTurnDots: () => void
}

export function SettingsScreen({ showTrackDots, showTurnDots, onToggleTrackDots, onToggleTurnDots }: SettingsScreenProps) {
  return (
    <div className="settings-screen">
      <div className="settings-title">Einstellungen</div>
      <div className="settings-row">
        <div className="settings-label">
          <span className="settings-dot settings-dot-blue" />
          Track-Punkte
        </div>
        <button
          className={`settings-toggle ${showTrackDots ? 'settings-toggle-on' : ''}`}
          onClick={onToggleTrackDots}
        >
          {showTrackDots ? 'AN' : 'AUS'}
        </button>
      </div>
      <div className="settings-row">
        <div className="settings-label">
          <span className="settings-dot settings-dot-yellow" />
          Abbiegepunkte
        </div>
        <button
          className={`settings-toggle ${showTurnDots ? 'settings-toggle-on' : ''}`}
          onClick={onToggleTurnDots}
        >
          {showTurnDots ? 'AN' : 'AUS'}
        </button>
      </div>
    </div>
  )
}
