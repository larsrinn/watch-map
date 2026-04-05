import { useState, useRef, useEffect, useCallback } from 'react'

const SCREEN_COUNT = 4

export function useScreenNavigation() {
  const [currentScreen, setCurrentScreen] = useState(0)
  const bezelRef = useRef<HTMLDivElement>(null)
  const swipeTouchStartRef = useRef<{ x: number; y: number } | null>(null)

  const goToScreen = useCallback((idx: number) => {
    setCurrentScreen(idx)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrentScreen(s => Math.min(s + 1, SCREEN_COUNT - 1))
      if (e.key === 'ArrowLeft') setCurrentScreen(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Touch swipe navigation
  useEffect(() => {
    const bezel = bezelRef.current
    if (!bezel) return

    const handleTouchStart = (e: TouchEvent) => {
      swipeTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!swipeTouchStartRef.current) return
      const dx = e.changedTouches[0].clientX - swipeTouchStartRef.current.x
      const dy = e.changedTouches[0].clientY - swipeTouchStartRef.current.y
      swipeTouchStartRef.current = null
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) setCurrentScreen(s => Math.min(s + 1, SCREEN_COUNT - 1))
      else setCurrentScreen(s => Math.max(s - 1, 0))
    }

    bezel.addEventListener('touchstart', handleTouchStart)
    bezel.addEventListener('touchend', handleTouchEnd)
    return () => {
      bezel.removeEventListener('touchstart', handleTouchStart)
      bezel.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return { currentScreen, bezelRef, goToScreen, screenCount: SCREEN_COUNT }
}
