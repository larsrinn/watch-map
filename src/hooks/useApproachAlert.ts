import { useEffect, useRef } from 'react'
import { playTurnBeep } from '../audio'

interface UseApproachAlertOptions {
  distanceToNextTurn: number | null
  nextTurnIdx: number | undefined
  approachAlertFar: number
  approachAlertNear: number
  turnAlarmEnabled: boolean
  wakeUp: (haptic: boolean) => void
  resetSleepTimer: () => void
}

export function useApproachAlert({
  distanceToNextTurn,
  nextTurnIdx,
  approachAlertFar,
  approachAlertNear,
  turnAlarmEnabled,
  wakeUp,
  resetSleepTimer,
}: UseApproachAlertOptions): { approaching: boolean } {
  const firedFarRef = useRef(false)
  const firedNearRef = useRef(false)
  const prevTurnIdxRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (nextTurnIdx !== prevTurnIdxRef.current) {
      firedFarRef.current = false
      firedNearRef.current = false
      prevTurnIdxRef.current = nextTurnIdx
    }

    if (distanceToNextTurn == null || nextTurnIdx == null) return

    if (distanceToNextTurn < approachAlertFar && !firedFarRef.current) {
      firedFarRef.current = true
      wakeUp(true)
      resetSleepTimer()
      if (turnAlarmEnabled) playTurnBeep()
    }

    if (distanceToNextTurn < approachAlertNear && !firedNearRef.current) {
      firedNearRef.current = true
      if (turnAlarmEnabled) playTurnBeep()
    }
  }, [distanceToNextTurn, nextTurnIdx, approachAlertFar, approachAlertNear, turnAlarmEnabled, wakeUp, resetSleepTimer])

  const approaching = distanceToNextTurn != null && distanceToNextTurn < approachAlertFar
  return { approaching }
}
