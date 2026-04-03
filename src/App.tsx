import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

// Types
interface LatLon {
  lat: number
  lon: number
}

interface TurnInstruction {
  idx: number
  text: string
  icon: string
}

interface TileEntry {
  img: HTMLImageElement
  lastUsed: number
}

interface Point {
  x: number
  y: number
}

// Constants
const TILE_SIZE = 256
const W = 198
const HALF = W / 2
const MIN_ZOOM = 10
const MAX_ZOOM = 17
const SLEEP_TIMEOUT = 3000

// Sample GPX data (Alexanderplatz to Brandenburger Tor)
const GPX: [number, number][] = [
  [52.5219, 13.4133], [52.5213, 13.4100], [52.5205, 13.4055],
  [52.5200, 13.4010], [52.5196, 13.3965], [52.5191, 13.3920],
  [52.5185, 13.3880], [52.5182, 13.3840], [52.5180, 13.3800],
  [52.5178, 13.3760], [52.5175, 13.3720], [52.5172, 13.3690],
  [52.5168, 13.3650], [52.5163, 13.3610], [52.5160, 13.3580],
  [52.5158, 13.3550], [52.5155, 13.3510], [52.5153, 13.3480],
  [52.5160, 13.3460], [52.5163, 13.3440], [52.5168, 13.3410],
  [52.5172, 13.3390],
]

const TURNS: TurnInstruction[] = [
  { idx: 0, text: "Start: Alexanderplatz", icon: "🏁" },
  { idx: 3, text: "Geradeaus auf Karl-Liebknecht", icon: "↑" },
  { idx: 7, text: "Links auf Spandauer Str.", icon: "↰" },
  { idx: 10, text: "Rechts auf Unter den Linden", icon: "↱" },
  { idx: 15, text: "Geradeaus weiter", icon: "↑" },
  { idx: 19, text: "Ziel: Brandenburger Tor", icon: "🏁" },
]

// Helper functions
function lon2tile(lon: number, z: number): number {
  return ((lon + 180) / 360) * (1 << z)
}

function lat2tile(lat: number, z: number): number {
  const r = lat * Math.PI / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * (1 << z)
}

function latLonPx(lat: number, lon: number, z: number): Point {
  return { x: lon2tile(lon, z) * TILE_SIZE, y: lat2tile(lat, z) * TILE_SIZE }
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function App() {
  // State
  const [zoom, setZoom] = useState(15)
  const [simIdx, setSimIdx] = useState(0)
  const [running, setRunning] = useState(false)
  const [followMode, setFollowMode] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [sleeping, setSleeping] = useState(false)
  const [walkedPath, setWalkedPath] = useState<[number, number][]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cacheSize, setCacheSize] = useState(0)
  const [haptic, setHaptic] = useState(false)
  const [renderKey, setRenderKey] = useState(0)

  // Refs
  const watchRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const sleepTimerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const tileCacheRef = useRef<Map<string, TileEntry>>(new Map())

  // Tile cache functions
  const getTileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`

  const loadTile = useCallback((z: number, x: number, y: number): HTMLImageElement => {
    const key = getTileKey(z, x, y)
    const cache = tileCacheRef.current

    if (cache.has(key)) {
      const entry = cache.get(key)!
      entry.lastUsed = Date.now()
      return entry.img
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    img.onload = () => setRenderKey(k => k + 1)
    img.onerror = () => { (img as any)._failed = true }

    cache.set(key, { img, lastUsed: Date.now() })

    if (cache.size > 150) {
      const entries = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      const toRemove = entries.slice(0, Math.floor(150 * 0.3))
      toRemove.forEach(([k]) => cache.delete(k))
    }

    setCacheSize(cache.size)
    return img
  }, [])

  // Get current instruction
  const currentInstruction = useCallback((): TurnInstruction => {
    return [...TURNS].reverse().find(t => t.idx <= simIdx) || TURNS[0]
  }, [simIdx])

  // Sleep/Wake functions
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
    if (running) {
      sleepTimerRef.current = window.setTimeout(goToSleep, SLEEP_TIMEOUT)
    }
  }, [running, goToSleep])

  // Get center point
  const getCenter = useCallback((): Point => {
    const pos = GPX[simIdx]
    const c = latLonPx(pos[0], pos[1], zoom)
    return { x: c.x + (followMode ? 0 : offsetX), y: c.y + (followMode ? 0 : offsetY) }
  }, [simIdx, zoom, followMode, offsetX, offsetY])

  // Render tiles
  const renderTiles = useCallback(() => {
    const c = getCenter()
    const tiles: JSX.Element[] = []
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
        if (cached && cached.complete && !(cached as any)._failed) {
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
    return tiles
  }, [getCenter, zoom, loadTile, renderKey])

  // Render track SVG
  const renderTrack = useCallback(() => {
    const c = getCenter()

    // Full track in blue
    const trackPts = GPX.map(([lat, lon]) => {
      const p = latLonPx(lat, lon, zoom)
      return { x: p.x - c.x + HALF, y: p.y - c.y + HALF }
    })
    const trackD = trackPts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')

    // Walked path in red
    const walked = walkedPath.map(([lat, lon]) => {
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
  }, [getCenter, zoom, walkedPath])

  // Render position
  const renderPosition = useCallback(() => {
    const c = getCenter()
    const pos = GPX[simIdx]
    const p = latLonPx(pos[0], pos[1], zoom)
    const x = p.x - c.x + HALF
    const y = p.y - c.y + HALF

    return (
      <>
        <circle cx={x} cy={y} r="10" fill="rgba(0,120,255,0.2)" />
        <circle cx={x} cy={y} r="5" fill="#007AFF" stroke="#fff" strokeWidth="2" />
      </>
    )
  }, [getCenter, simIdx, zoom])

  // Simulation control
  const toggleSim = useCallback(() => {
    if (!running) {
      setRunning(true)
      setWalkedPath([GPX[simIdx]])
      resetSleepTimer()
    } else {
      setRunning(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
      wakeUp(false)
    }
  }, [running, simIdx, resetSleepTimer, wakeUp])

  const recenter = useCallback(() => {
    setFollowMode(true)
    setOffsetX(0)
    setOffsetY(0)
  }, [])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
    resetSleepTimer()
  }, [resetSleepTimer])

  // Event handlers
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

  const handleSleepClick = useCallback(() => {
    wakeUp(false)
  }, [wakeUp])

  // Effects
  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulation interval
  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSimIdx(prev => {
          const next = (prev + 1) % GPX.length
          if (next === 0) {
            setWalkedPath([])
          } else {
            setWalkedPath(path => [...path, GPX[next]])
          }

          // Check for turn instruction
          const instr = TURNS.find(t => t.idx === next)
          if (instr) {
            wakeUp(true)
            resetSleepTimer()
          }

          return next
        })
        setFollowMode(true)
      }, 1200)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [running, wakeUp, resetSleepTimer])

  // Sleep timer effect
  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current)
      }
    }
  }, [resetSleepTimer])

  // Get current instruction and distance
  const instr = currentInstruction()
  const distance = simIdx < GPX.length - 1 ? Math.round(haversine(GPX[simIdx], GPX[simIdx + 1])) : 0

  return (
    <div className="app-container">
      <div className="bezel">
        <div
          ref={watchRef}
          className={`watch ${haptic ? 'haptic' : ''} ${sleeping ? 'sleeping' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
        >
          <div id="tiles">{!sleeping && renderTiles()}</div>
          <svg className="track-svg" xmlns="http://www.w3.org/2000/svg">
            {!sleeping && renderTrack()}
          </svg>
          <svg className="pos-svg" xmlns="http://www.w3.org/2000/svg">
            {!sleeping && renderPosition()}
          </svg>
          <div className="nav-banner">
            <span className="nav-icon">{instr.icon}</span>
            <div>
              <div className="nav-text">{instr.text}</div>
              <div className="nav-dist">{distance}m zum nächsten Punkt</div>
            </div>
          </div>
          <div className="zoom-ind">Z{zoom}</div>
          <div className="cache-ind">Cache: {cacheSize}</div>
          <div className="inner-shadow"></div>
          <div
            className="sleep-overlay"
            style={{ opacity: sleeping ? 1 : 0, pointerEvents: sleeping ? 'auto' : 'none' }}
            onClick={handleSleepClick}
          >
            <div className="time">
              {currentTime.getHours().toString().padStart(2, '0')}:
              {currentTime.getMinutes().toString().padStart(2, '0')}
            </div>
            <div className="nav-hint">
              {instr.icon} {instr.text}
            </div>
            <div className="tap-hint">Antippen für Karte</div>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#3498db' }}></div>
          Track
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#e74c3c' }}></div>
          Gelaufen
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: 'transparent', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #007AFF' }}></div>
          Position
        </div>
      </div>

      <div className="controls">
        <button
          className="btn"
          style={{ background: running ? '#c0392b' : '#27ae60' }}
          onClick={toggleSim}
        >
          {running ? '⏸ Stop' : '▶ Simulation'}
        </button>
        <button className="btn" style={{ background: '#2980b9' }} onClick={recenter}>
          📍 Zentrieren
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(1)}>
          +
        </button>
        <button className="btn" style={{ background: '#555' }} onClick={() => changeZoom(-1)}>
          −
        </button>
      </div>

      <div className="hint">
        Display schläft nach 3s ein · Antippen weckt auf · Bei Abbiegehinweis wacht es automatisch auf<br />
        Scroll = Zoom · Drag = Pan
      </div>
    </div>
  )
}

export default App
