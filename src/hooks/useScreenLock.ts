import { useState, useRef, useCallback, useEffect } from 'react'

const UNLOCK_DURATION = 1000

export function useScreenLock() {
  const [locked, setLocked] = useState(false)
  const [unlockProgress, setUnlockProgress] = useState(0)
  const pressStartRef = useRef<number | null>(null)
  const animFrameRef = useRef(0)

  const cancelUnlock = useCallback(() => {
    pressStartRef.current = null
    cancelAnimationFrame(animFrameRef.current)
    setUnlockProgress(0)
  }, [])

  const handleLockPointerDown = useCallback(() => {
    if (!locked) {
      setLocked(true)
      return
    }
    pressStartRef.current = Date.now()
    const animate = () => {
      if (pressStartRef.current == null) return
      const progress = Math.min((Date.now() - pressStartRef.current) / UNLOCK_DURATION, 1)
      setUnlockProgress(progress)
      if (progress >= 1) {
        setLocked(false)
        setUnlockProgress(0)
        pressStartRef.current = null
        return
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }, [locked])

  const handleLockPointerUp = useCallback(() => cancelUnlock(), [cancelUnlock])

  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), [])

  return { locked, unlockProgress, handleLockPointerDown, handleLockPointerUp }
}
