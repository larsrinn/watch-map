import { useState, useRef, useCallback } from 'react'
import { parseGpx } from '../gpxParser'
import type { ParsedGpx } from '../gpxParser'
import { usePosition } from './usePosition'
import { preloadTiles } from '../tilePreloader'
import type { PreloadStatus } from '../tilePreloader'
import { formatDistance } from '../geo'

const EMPTY_TRACK_POINTS: [number, number][] = []
const EMPTY_TURNS: ParsedGpx['turns'] = []

export interface NavInstruction {
  icon: string
  text: string
  distText: string
  totalDistText: string
}

export function useNavigation() {
  const [gpxData, setGpxData] = useState<ParsedGpx | null>(null)
  const [gpxFileName, setGpxFileName] = useState('')
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({ phase: 'idle' })
  const preloadAbortRef = useRef<AbortController | null>(null)

  const trackPoints = gpxData?.trackPoints ?? EMPTY_TRACK_POINTS
  const turns = gpxData?.turns ?? EMPTY_TURNS
  const { position, segmentIdx, navigationState, altitude, isActive, setManualPosition } = usePosition(trackPoints, turns)

  const handleGpxLoad = useCallback((content: string, fileName: string) => {
    const parsed = parseGpx(content)
    setGpxData(parsed)
    setGpxFileName(fileName)

    preloadAbortRef.current?.abort()
    const controller = new AbortController()
    preloadAbortRef.current = controller
    setPreloadStatus({ phase: 'running', done: 0, total: 0 })
    preloadTiles(
      parsed.trackPoints,
      (done, total) => setPreloadStatus({ phase: 'running', done, total }),
      controller.signal,
    ).then(({ cached }) => {
      setPreloadStatus({ phase: 'done', cached })
    }).catch((err: unknown) => {
      if ((err as Error)?.name !== 'AbortError') setPreloadStatus({ phase: 'error' })
    })
  }, [])

  const instr = navigationState.nextTurn
  const distanceToNext = Math.round(navigationState.distanceToNextTurn ?? navigationState.totalRemaining)
  const totalRemaining = Math.round(navigationState.totalRemaining)
  const navInstruction: NavInstruction | null = gpxData ? {
    icon: instr?.icon ?? '↑',
    text: instr?.text ?? '',
    distText: formatDistance(distanceToNext),
    totalDistText: formatDistance(totalRemaining),
  } : null

  const handleGpxUnload = useCallback(() => {
    preloadAbortRef.current?.abort()
    setGpxData(null)
    setGpxFileName('')
    setPreloadStatus({ phase: 'idle' })
  }, [])

  return {
    gpxData, gpxFileName, preloadStatus,
    trackPoints, turns,
    position, segmentIdx, navigationState, altitude, isActive,
    navInstruction,
    handleGpxLoad,
    handleGpxUnload,
    setManualPosition,
  }
}
