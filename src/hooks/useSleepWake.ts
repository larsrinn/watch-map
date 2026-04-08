import { useState, useRef, useCallback } from 'react'

const SLEEP_TIMEOUT = 3000

export function useSleepWake(isActive: boolean) {
  const [sleeping, setSleeping] = useState(false)
  const [haptic, setHaptic] = useState(false)
  const sleepTimerRef = useRef<number | null>(null)

  const goToSleep = useCallback(() => {
    setSleeping(true)
  }, [])

  const wakeUp = useCallback((fromHaptic: boolean) => {
    setSleeping(false)
    if (fromHaptic) {
      setHaptic(true)
      setTimeout(() => setHaptic(false), 400)
    }
  }, [])

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
    }
    if (isActive) {
      sleepTimerRef.current = window.setTimeout(goToSleep, SLEEP_TIMEOUT)
    }
  }, [isActive, goToSleep])

  const clearSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }
  }, [])

  return { sleeping, haptic, wakeUp, resetSleepTimer, clearSleepTimer }
}
