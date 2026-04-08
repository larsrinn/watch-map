import { useEffect, useRef, useState } from 'react'
import { playTurnBeep, playOffTrackBeep } from '../audio'

interface UseAlarmsOptions {
  turnAlarmEnabled: boolean
  offTrackAlarmEnabled: boolean
  offTrackThreshold: number
  offTrackDistance: number
  turnAlarmTrigger: number
}

const HYSTERESIS_FACTOR = 0.8

export function useAlarms({
  turnAlarmEnabled,
  offTrackAlarmEnabled,
  offTrackThreshold,
  offTrackDistance,
  turnAlarmTrigger,
}: UseAlarmsOptions): { isOffTrack: boolean } {
  // --- Turn alarm ---
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (turnAlarmEnabled) {
      console.log('[Alarm] Turn alarm triggered')
      playTurnBeep()
    }
  }, [turnAlarmTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Off-track alarm ---
  const wasOffTrackRef = useRef(false)
  const [isOffTrack, setIsOffTrack] = useState(false)

  useEffect(() => {
    if (!offTrackAlarmEnabled) {
      wasOffTrackRef.current = false
      setIsOffTrack(false)
      return
    }
    if (offTrackDistance > offTrackThreshold) {
      setIsOffTrack(true)
      if (!wasOffTrackRef.current) {
        wasOffTrackRef.current = true
        console.log('[Alarm] Off-track alarm triggered')
        playOffTrackBeep()
      }
    } else if (offTrackDistance <= offTrackThreshold * HYSTERESIS_FACTOR) {
      if (wasOffTrackRef.current) {
        console.log('[Alarm] Off-track alarm cleared')
      }
      wasOffTrackRef.current = false
      setIsOffTrack(false)
    }
  }, [offTrackDistance, offTrackAlarmEnabled, offTrackThreshold])

  return { isOffTrack }
}
