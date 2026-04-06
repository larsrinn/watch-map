import { useEffect, useRef } from 'react'
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
    if (turnAlarmEnabled) playTurnBeep()
  }, [turnAlarmTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Off-track alarm ---
  const wasOffTrackRef = useRef(false)
  const isOffTrackRef = useRef(false)

  useEffect(() => {
    if (!offTrackAlarmEnabled) {
      wasOffTrackRef.current = false
      isOffTrackRef.current = false
      return
    }
    if (offTrackDistance > offTrackThreshold) {
      isOffTrackRef.current = true
      if (!wasOffTrackRef.current) {
        wasOffTrackRef.current = true
        playOffTrackBeep()
      }
    } else if (offTrackDistance <= offTrackThreshold * HYSTERESIS_FACTOR) {
      wasOffTrackRef.current = false
      isOffTrackRef.current = false
    }
  }, [offTrackDistance, offTrackAlarmEnabled, offTrackThreshold])

  return { isOffTrack: isOffTrackRef.current }
}
