export interface TurnInstruction {
  idx: number
  text: string
  icon: string
}

export interface ParsedGpx {
  name: string
  trackPoints: [number, number][]
  turns: TurnInstruction[]
  distToNextTurn: number[]
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

const TURN_ICON: Record<string, string> = {
  TR: '↱',
  TL: '↰',
  TSHR: '↱',
  TSHL: '↰',
  TSLR: '↗',
  TSLL: '↖',
  C: '↑',
}

export function parseGpx(xml: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')

  const name = doc.querySelector('trk > name')?.textContent ?? ''

  const trackPoints: [number, number][] = Array.from(
    doc.querySelectorAll('trkseg > trkpt')
  ).map(pt => [
    parseFloat(pt.getAttribute('lat')!),
    parseFloat(pt.getAttribute('lon')!),
  ])

  const turns: TurnInstruction[] = Array.from(
    doc.querySelectorAll('rte > rtept')
  ).map(pt => {
    const desc = pt.querySelector('desc')?.textContent?.trim() ?? ''
    const turnType = pt.querySelector('turn')?.textContent?.trim() ?? ''
    const idx = parseInt(pt.querySelector('offset')?.textContent ?? '0', 10)

    let icon: string
    if (desc === 'start' || desc === 'destination') icon = '🏁'
    else icon = TURN_ICON[turnType] ?? '↑'

    return { idx, text: desc, icon }
  })

  const n = trackPoints.length
  const distToNextTurn = new Array<number>(n).fill(0)
  const turnSet = new Set(turns.map(t => t.idx))
  for (let i = n - 2; i >= 0; i--) {
    if (turnSet.has(i)) {
      distToNextTurn[i] = 0
    } else {
      distToNextTurn[i] = haversine(trackPoints[i], trackPoints[i + 1]) + distToNextTurn[i + 1]
    }
  }

  return { name, trackPoints, turns, distToNextTurn }
}
