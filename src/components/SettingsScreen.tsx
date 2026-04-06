import './SettingsScreen.css'

interface SettingsScreenProps {
  showTrackDots: boolean
  showTurnDots: boolean
  onToggleTrackDots: () => void
  onToggleTurnDots: () => void
  turnAlarmEnabled: boolean
  offTrackAlarmEnabled: boolean
  offTrackThreshold: number
  onToggleTurnAlarm: () => void
  onToggleOffTrackAlarm: () => void
  onChangeOffTrackThreshold: (value: number) => void
}

export function SettingsScreen({
  showTrackDots, showTurnDots, onToggleTrackDots, onToggleTurnDots,
  turnAlarmEnabled, offTrackAlarmEnabled, offTrackThreshold,
  onToggleTurnAlarm, onToggleOffTrackAlarm, onChangeOffTrackThreshold,
}: SettingsScreenProps) {
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
      <div className="settings-row">
        <div className="settings-label">
          <span className="settings-dot settings-dot-green" />
          Abbiege-Alarm
        </div>
        <button
          className={`settings-toggle ${turnAlarmEnabled ? 'settings-toggle-on' : ''}`}
          onClick={onToggleTurnAlarm}
        >
          {turnAlarmEnabled ? 'AN' : 'AUS'}
        </button>
      </div>
      <div className="settings-row">
        <div className="settings-label">
          <span className="settings-dot settings-dot-red" />
          Abweichungs-Alarm
        </div>
        <button
          className={`settings-toggle ${offTrackAlarmEnabled ? 'settings-toggle-on' : ''}`}
          onClick={onToggleOffTrackAlarm}
        >
          {offTrackAlarmEnabled ? 'AN' : 'AUS'}
        </button>
      </div>
      {offTrackAlarmEnabled && (
        <div className="settings-row">
          <div className="settings-label">Schwelle</div>
          <div className="settings-stepper">
            <button
              className="settings-stepper-btn"
              onClick={() => onChangeOffTrackThreshold(offTrackThreshold - 10)}
            >
              −
            </button>
            <span className="settings-stepper-value">{offTrackThreshold}m</span>
            <button
              className="settings-stepper-btn"
              onClick={() => onChangeOffTrackThreshold(offTrackThreshold + 10)}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
