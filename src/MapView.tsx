import { useState, useRef, useCallback, useMemo, memo, type ReactElement } from 'react'
import type { RecordedPoint } from './types'
import type { TurnInstruction } from './gpxParser'
import { LruCache } from './LruCache'

// Constants
const TILE_SIZE = 256
const W = 198
const HALF = W / 2

// Helpers
function lon2tile(lon: number, z: number): number {
  return ((lon + 180) / 360) * (1 << z)
}

function lat2tile(lat: number, z: number): number {
  const r = lat * Math.PI / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * (1 << z)
}

function latLonPx(lat: number, lon: number, z: number): { x: number; y: number } {
  return { x: lon2tile(lon, z) * TILE_SIZE, y: lat2tile(lat, z) * TILE_SIZE }
}

const MAX_TILE_CACHE = 150

interface TileEntry {
  img: HTMLImageElement
}

export interface NavInstruction {
  icon: string
  text: string
  distText: string
  totalDistText: string
}

interface CenterPoint {
  x: number
  y: number
}

function getCenter(currentPosition: [number, number], zoom: number, followMode: boolean, offsetX: number, offsetY: number): CenterPoint {
  const c = latLonPx(currentPosition[0], currentPosition[1], zoom)
  return { x: c.x + (followMode ? 0 : offsetX), y: c.y + (followMode ? 0 : offsetY) }
}

// TileLayer — isolated component so tile-load re-renders don't affect track/position SVGs
interface TileLayerProps {
  zoom: number
  center: CenterPoint
}

export const TileLayer = memo(function TileLayer({ zoom, center }: TileLayerProps) {
  const [renderKey, setRenderKey] = useState(0)
  const tileCacheRef = useRef(new LruCache<string, TileEntry>(MAX_TILE_CACHE))

  const loadTile = useCallback((z: number, x: number, y: number): HTMLImageElement => {
    const key = `${z}/${x}/${y}`
    const cache = tileCacheRef.current

    const cached = cache.get(key)
    if (cached) return cached.img

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    img.onload = () => setRenderKey(k => k + 1)
    img.onerror = () => { (img as HTMLImageElement & { _failed: boolean })._failed = true }

    cache.set(key, { img })
    return img
  }, [])

  const tiles: ReactElement[] = []
  const needed = Math.ceil(W / TILE_SIZE) + 2
  const half = Math.floor(needed / 2)
  const ctX = Math.floor(center.x / TILE_SIZE)
  const ctY = Math.floor(center.y / TILE_SIZE)
  const oX = HALF - (center.x - ctX * TILE_SIZE)
  const oY = HALF - (center.y - ctY * TILE_SIZE)
  const maxT = 1 << zoom

  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const ty = ctY + dy
      if (ty < 0 || ty >= maxT) continue
      const tx = ((ctX + dx) % maxT + maxT) % maxT
      const px = oX + dx * TILE_SIZE
      const py = oY + dy * TILE_SIZE
      if (px + TILE_SIZE < 0 || px > W || py + TILE_SIZE < 0 || py > W) continue

      const cached = loadTile(zoom, tx, ty)
      if (cached && cached.complete && !(cached as HTMLImageElement & { _failed?: boolean })._failed) {
        tiles.push(
          <img
            key={`${zoom}-${tx}-${ty}`}
            src={cached.src}
            width={TILE_SIZE}
            height={TILE_SIZE}
            style={{ left: px + 'px', top: py + 'px' }}
            alt=""
          />
        )
      }
    }
  }
  // renderKey is read here to trigger re-renders when tiles load
  void renderKey
  return <>{tiles}</>
})

interface MapViewProps {
  zoom: number
  currentPosition: [number, number]
  followMode: boolean
  offsetX: number
  offsetY: number
  trackPoints: [number, number][]
  recordedPath: RecordedPoint[]
  sleeping: boolean
  onSleepClick: () => void
  currentTime: Date
  navInstruction: NavInstruction | null
  showTrackDots: boolean
  showTurnDots: boolean
  turns: TurnInstruction[]
}

export function MapView({
  zoom,
  currentPosition,
  followMode,
  offsetX,
  offsetY,
  trackPoints,
  recordedPath,
  sleeping,
  onSleepClick,
  currentTime,
  navInstruction,
  showTrackDots,
  showTurnDots,
  turns,
}: MapViewProps) {
  const center = getCenter(currentPosition, zoom, followMode, offsetX, offsetY)

  // Memoize world-pixel projections — only recompute when zoom or data changes, not on every position update
  const trackPathD = useMemo(() => {
    const pts = trackPoints.map(([lat, lon]) => latLonPx(lat, lon, zoom))
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  }, [zoom, trackPoints])

  const walkedPathD = useMemo(() => {
    const pts = recordedPath.map(({ lat, lon }) => latLonPx(lat, lon, zoom))
    return pts.length > 1
      ? pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
      : ''
  }, [zoom, recordedPath])

  const trackPtsWorld = useMemo(() =>
    trackPoints.map(([lat, lon]) => latLonPx(lat, lon, zoom)),
    [zoom, trackPoints]
  )

  const renderTrack = useCallback(() => {
    const tx = HALF - center.x
    const ty = HALF - center.y

    return (
      <g transform={`translate(${tx},${ty})`}>
        <path d={trackPathD} fill="none" stroke="#3498db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <path d={trackPathD} fill="none" stroke="#5dade2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        {walkedPathD && (
          <>
            <path d={walkedPathD} fill="none" stroke="#e74c3c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            <path d={walkedPathD} fill="none" stroke="#f39c12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          </>
        )}
        {showTrackDots && trackPtsWorld.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#3498db" opacity="0.7" />
        ))}
        {showTurnDots && turns.map((t) => {
          const tp = trackPtsWorld[t.idx]
          if (!tp) return null
          return <circle key={t.idx} cx={tp.x} cy={tp.y} r="3.5" fill="#f1c40f" stroke="#fff" strokeWidth="1" opacity="0.9" />
        })}
      </g>
    )
  }, [center, trackPathD, walkedPathD, trackPtsWorld, showTrackDots, showTurnDots, turns])

  const renderPosition = useCallback(() => {
    const p = latLonPx(currentPosition[0], currentPosition[1], zoom)
    const tx = HALF - center.x
    const ty = HALF - center.y

    return (
      <g transform={`translate(${tx},${ty})`}>
        <circle cx={p.x} cy={p.y} r="10" fill="rgba(0,120,255,0.2)" />
        <circle cx={p.x} cy={p.y} r="5" fill="#007AFF" stroke="#fff" strokeWidth="2" />
      </g>
    )
  }, [center, currentPosition, zoom])

  return (
    <>
      <div id="tiles">{!sleeping && <TileLayer zoom={zoom} center={center} />}</div>
      <svg className="track-svg" xmlns="http://www.w3.org/2000/svg">
        {!sleeping && renderTrack()}
      </svg>
      <svg className="pos-svg" xmlns="http://www.w3.org/2000/svg">
        {!sleeping && renderPosition()}
      </svg>
      {navInstruction && (
        <div className="nav-banner">
          <span className="nav-icon">{navInstruction.icon}</span>
          <div className="nav-details">
            <div className="nav-text">{navInstruction.text}</div>
            <div className="nav-dist">{navInstruction.distText}</div>
            <div className="nav-total">{navInstruction.totalDistText}</div>
          </div>
        </div>
      )}
      <div className="zoom-ind">Z{zoom}</div>
      <div className="cache-ind"></div>
      <div className="inner-shadow"></div>
      <div
        className="sleep-overlay"
        style={{ opacity: sleeping ? 1 : 0, pointerEvents: sleeping ? 'auto' : 'none' }}
        onClick={onSleepClick}
      >
        <div className="time">
          {currentTime.getHours().toString().padStart(2, '0')}:
          {currentTime.getMinutes().toString().padStart(2, '0')}
        </div>
        {navInstruction && (
          <>
            <div className="sleep-nav-icon">{navInstruction.icon}</div>
            <div className="nav-hint">{navInstruction.text}</div>
            <div className="sleep-nav-dist">{navInstruction.distText}</div>
            <div className="sleep-nav-total">{navInstruction.totalDistText}</div>
          </>
        )}
      </div>
    </>
  )
}
