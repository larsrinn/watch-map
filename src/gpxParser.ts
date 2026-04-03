export interface TurnInstruction {
  idx: number
  text: string
  icon: string
}

export interface ParsedGpx {
  name: string
  trackPoints: [number, number][]
  turns: TurnInstruction[]
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

  return { name, trackPoints, turns }
}
