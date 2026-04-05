import { useState, useRef, useCallback, useEffect } from 'react'

const MIN_ZOOM = 10
const MAX_ZOOM = 17

export function useMapInteraction(
  sleeping: boolean,
  wakeUp: (fromHaptic: boolean) => void,
  resetSleepTimer: () => void,
) {
  const [zoom, setZoom] = useState(15)
  const [followMode, setFollowMode] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const recenter = useCallback(() => {
    setFollowMode(true)
    setOffsetX(0)
    setOffsetY(0)
  }, [])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
    resetSleepTimer()
  }, [resetSleepTimer])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (sleeping) {
      wakeUp(false)
      return
    }
    e.preventDefault()
    changeZoom(e.deltaY < 0 ? 1 : -1)
  }, [sleeping, wakeUp, changeZoom])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (sleeping) return
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
    setFollowMode(false)
    resetSleepTimer()
  }, [sleeping, offsetX, offsetY, resetSleepTimer])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return
    setOffsetX(dragStartRef.current.ox - (e.clientX - dragStartRef.current.x))
    setOffsetY(dragStartRef.current.oy - (e.clientY - dragStartRef.current.y))
  }, [])

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  return {
    zoom, followMode, setFollowMode, offsetX, offsetY,
    recenter, changeZoom,
    handleWheel, handlePointerDown,
  }
}
