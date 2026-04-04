import { useState, useRef, useCallback, type ReactElement } from 'react'
import type { RecordedPoint } from './types'

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

interface TileEntry {
  img: HTMLImageElement
  lastUsed: number
}

export interface NavInstruction {
  icon: string
  text: string
  distText: string
}

interface MapViewProps {
  zoom: number
  currentPosition: [number, number]
  followMode: boolean
  offsetX: number
  offsetY: number
  trackPoints: [number, number][]
  walkedPath: RecordedPoint[]
  sleeping: boolean
  onSleepClick: () => void
  currentTime: Date
  navInstruction: NavInstruction
}

export function MapView({
  zoom,
  currentPosition,
  followMode,
  offsetX,
  offsetY,
  trackPoints,
  walkedPath,
  sleeping,
  onSleepClick,
  currentTime,
  navInstruction,
}: MapViewProps) {
  const [renderKey, setRenderKey] = useState(0)
  const [cacheSize, setCacheSize] = useState(0)
  const tileCacheRef = useRef<Map<string, TileEntry>>(new Map())

  const loadTile = useCallback((z: number, x: number, y: number): HTMLImageElement => {
    const key = `${z}/${x}/${y}`
    const cache = tileCacheRef.current

    if (cache.has(key)) {
      const entry = cache.get(key)!
      entry.lastUsed = Date.now()
      return entry.img
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    img.onload = () => setRenderKey(k => k + 1)
    img.onerror = () => { (img as HTMLImageElement & { _failed: boolean })._failed = true }

    cache.set(key, { img, lastUsed: Date.now() })

    if (cache.size > 150) {
      const entries = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      entries.slice(0, Math.floor(150 * 0.3)).forEach(([k]) => cache.delete(k))
    }

    setCacheSize(cache.size)
    return img
  }, [])

  const getCenter = useCallback(() => {
    const c = latLonPx(currentPosition[0], currentPosition[1], zoom)
    return { x: c.x + (followMode ? 0 : offsetX), y: c.y + (followMode ? 0 : offsetY) }
  }, [currentPosition, zoom, followMode, offsetX, offsetY])

  const renderTiles = useCallback(() => {
    const c = getCenter()
    const tiles: ReactElement[] = []
    const needed = Math.ceil(W / TILE_SIZE) + 2
    const half = Math.floor(needed / 2)
    const ctX = Math.floor(c.x / TILE_SIZE)
    const ctY = Math.floor(c.y / TILE_SIZE)
    const oX = HALF - (c.x - ctX * TILE_SIZE)
    const oY = HALF - (c.y - ctY * TILE_SIZE)
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
    return tiles
  }, [getCenter, zoom, loadTile, renderKey])

  const renderTrack = useCallback(() => {
    const c = getCenter()

    const trackPts = trackPoints.map(([lat, lon]) => {
      const p = latLonPx(lat, lon, zoom)
      return { x: p.x - c.x + HALF, y: p.y - c.y + HALF }
    })
    const trackD = trackPts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')

    const walked = walkedPath.map(({ lat, lon }) => {
      const p = latLonPx(lat, lon, zoom)
      return { x: p.x - c.x + HALF, y: p.y - c.y + HALF }
    })
    const walkedD = walked.length > 1
      ? walked.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
      : ''

    return (
      <>
        <path d={trackD} fill="none" stroke="#3498db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <path d={trackD} fill="none" stroke="#5dade2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        {walkedD && (
          <>
            <path d={walkedD} fill="none" stroke="#e74c3c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            <path d={walkedD} fill="none" stroke="#f39c12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          </>
        )}
      </>
    )
  }, [getCenter, zoom, trackPoints, walkedPath])

  const renderPosition = useCallback(() => {
    const c = getCenter()
    const p = latLonPx(currentPosition[0], currentPosition[1], zoom)
    const x = p.x - c.x + HALF
    const y = p.y - c.y + HALF

    return (
      <>
        <circle cx={x} cy={y} r="10" fill="rgba(0,120,255,0.2)" />
        <circle cx={x} cy={y} r="5" fill="#007AFF" stroke="#fff" strokeWidth="2" />
      </>
    )
  }, [getCenter, currentPosition, zoom])

  return (
    <>
      <div id="tiles">{!sleeping && renderTiles()}</div>
      <svg className="track-svg" xmlns="http://www.w3.org/2000/svg">
        {!sleeping && renderTrack()}
      </svg>
      <svg className="pos-svg" xmlns="http://www.w3.org/2000/svg">
        {!sleeping && renderPosition()}
      </svg>
      <div className="nav-banner">
        <span className="nav-icon">{navInstruction.icon}</span>
        <div className="nav-details">
          <div className="nav-text">{navInstruction.text}</div>
          <div className="nav-dist">{navInstruction.distText}</div>
        </div>
      </div>
      <div className="zoom-ind">Z{zoom}</div>
      <div className="cache-ind">Cache: {cacheSize}</div>
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
        <div className="sleep-nav-icon">{navInstruction.icon}</div>
        <div className="nav-hint">{navInstruction.text}</div>
        <div className="sleep-nav-dist">{navInstruction.distText}</div>
      </div>
    </>
  )
}
