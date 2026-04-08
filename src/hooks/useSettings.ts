import { useState, useCallback } from 'react'

interface Settings {
  showTrackDots: boolean
  showTurnDots: boolean
  turnAlarmEnabled: boolean
  offTrackAlarmEnabled: boolean
  offTrackThreshold: number
  showInstructions: boolean
  approachAlertFar: number
  approachAlertNear: number
}

const STORAGE_KEY = 'watch-nav-settings'

const DEFAULTS: Settings = {
  showTrackDots: false,
  showTurnDots: false,
  turnAlarmEnabled: true,
  offTrackAlarmEnabled: true,
  offTrackThreshold: 30,
  showInstructions: true,
  approachAlertFar: 200,
  approachAlertNear: 20,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      return next
    })
  }, [])

  const toggle = useCallback((key: keyof Settings) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, update, toggle }
}
