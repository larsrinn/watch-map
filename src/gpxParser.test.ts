// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { parseGpx } from './gpxParser'

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

const MAIN_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <rte>
    <rtept lat="50.579262" lon="8.557239">
      <desc>start</desc>
      <extensions><offset>0</offset></extensions>
    </rtept>
    <rtept lat="50.579434" lon="8.557542">
      <desc>sharp right</desc>
      <extensions><turn>TR</turn><offset>1</offset></extensions>
    </rtept>
    <rtept lat="50.578769" lon="8.558417">
      <desc>slight left</desc>
      <extensions><turn>TSLL</turn><offset>2</offset></extensions>
    </rtept>
    <rtept lat="50.578742" lon="8.558736">
      <desc>destination</desc>
      <extensions><offset>2</offset></extensions>
    </rtept>
  </rte>
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="50.579262" lon="8.557239"><ele>163</ele></trkpt>
      <trkpt lat="50.579434" lon="8.557542"><ele>164</ele></trkpt>
      <trkpt lat="50.578769" lon="8.558417"><ele>166</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`

const NO_NAME_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="50.0" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`

const UNKNOWN_TURN_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <rte>
    <rtept lat="50.0" lon="8.0">
      <desc>weird maneuver</desc>
      <extensions><turn>BOGUS</turn><offset>0</offset></extensions>
    </rtept>
  </rte>
  <trk>
    <trkseg>
      <trkpt lat="50.0" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx', () => {
  describe('track points', () => {
    it('returns correct count', () => {
      const { trackPoints } = parseGpx(MAIN_FIXTURE)
      expect(trackPoints).toHaveLength(3)
    })

    it('first point has correct lat/lon', () => {
      const { trackPoints } = parseGpx(MAIN_FIXTURE)
      expect(trackPoints[0][0]).toBeCloseTo(50.579262)
      expect(trackPoints[0][1]).toBeCloseTo(8.557239)
    })

    it('last point has correct lat/lon', () => {
      const { trackPoints } = parseGpx(MAIN_FIXTURE)
      expect(trackPoints[2][0]).toBeCloseTo(50.578769)
      expect(trackPoints[2][1]).toBeCloseTo(8.558417)
    })
  })

  describe('turn instructions', () => {
    it('returns correct count', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns).toHaveLength(4)
    })

    it('start instruction gets flag icon with idx 0', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns[0].icon).toBe('🏁')
      expect(turns[0].idx).toBe(0)
      expect(turns[0].text).toBe('start')
    })

    it('TR maps to ↱', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns[1].icon).toBe('↱')
    })

    it('TSLL maps to ↖', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns[2].icon).toBe('↖')
    })

    it('destination gets flag icon', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns[3].icon).toBe('🏁')
      expect(turns[3].text).toBe('destination')
    })

    it('offset is parsed as integer index', () => {
      const { turns } = parseGpx(MAIN_FIXTURE)
      expect(turns[2].idx).toBe(2)
    })
  })

  describe('name extraction', () => {
    it('extracts name from <trk><name>', () => {
      const { name } = parseGpx(MAIN_FIXTURE)
      expect(name).toBe('Test Track')
    })

    it('returns empty string when name element is absent', () => {
      const { name } = parseGpx(NO_NAME_FIXTURE)
      expect(name).toBe('')
    })
  })

  describe('unknown turn types', () => {
    it('falls back to ↑ for unrecognized turn codes', () => {
      const { turns } = parseGpx(UNKNOWN_TURN_FIXTURE)
      expect(turns[0].icon).toBe('↑')
    })
  })
})

// 5 points along a line of latitude, turns at index 0 (start) and index 3 (right)
// Points spaced ~111m apart (0.001° latitude each)
const DIST_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <rte>
    <rtept lat="50.000" lon="8.0">
      <desc>start</desc>
      <extensions><offset>0</offset></extensions>
    </rtept>
    <rtept lat="50.003" lon="8.0">
      <desc>right</desc>
      <extensions><turn>TR</turn><offset>3</offset></extensions>
    </rtept>
    <rtept lat="50.004" lon="8.0">
      <desc>destination</desc>
      <extensions><offset>4</offset></extensions>
    </rtept>
  </rte>
  <trk>
    <name>Dist Test</name>
    <trkseg>
      <trkpt lat="50.000" lon="8.0"></trkpt>
      <trkpt lat="50.001" lon="8.0"></trkpt>
      <trkpt lat="50.002" lon="8.0"></trkpt>
      <trkpt lat="50.003" lon="8.0"></trkpt>
      <trkpt lat="50.004" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('distToNextTurn precomputation', () => {
  it('turn points themselves get distance 0', () => {
    const { distToNextTurn } = parseGpx(DIST_FIXTURE)
    expect(distToNextTurn[0]).toBe(0)  // start turn
    expect(distToNextTurn[3]).toBe(0)  // right turn
    expect(distToNextTurn[4]).toBe(0)  // last point
  })

  it('point before a turn gets one segment distance', () => {
    const { trackPoints, distToNextTurn } = parseGpx(DIST_FIXTURE)
    const expected = haversine(trackPoints[2], trackPoints[3])
    expect(distToNextTurn[2]).toBeCloseTo(expected, 0)
  })

  it('two points before a turn accumulates two segments', () => {
    const { trackPoints, distToNextTurn } = parseGpx(DIST_FIXTURE)
    const expected = haversine(trackPoints[1], trackPoints[2]) + haversine(trackPoints[2], trackPoints[3])
    expect(distToNextTurn[1]).toBeCloseTo(expected, 0)
  })
})

describe('next turn instruction lookup', () => {
  it('returns next upcoming turn when approaching it', () => {
    const { turns } = parseGpx(DIST_FIXTURE)
    // segmentIdx=2 → next turn is the one with idx > 2 → right at idx=3
    const segmentIdx = 2
    const next = turns.find(t => t.idx > segmentIdx) ?? turns[turns.length - 1]
    expect(next.idx).toBe(3)
    expect(next.text).toBe('right')
  })

  it('advances to the turn after passing one', () => {
    const { turns } = parseGpx(DIST_FIXTURE)
    // segmentIdx=3 (just passed turn at 3) → next is destination at idx=4
    const segmentIdx = 3
    const next = turns.find(t => t.idx > segmentIdx) ?? turns[turns.length - 1]
    expect(next.idx).toBe(4)
    expect(next.text).toBe('destination')
  })

  it('falls back to last turn when past all waypoints', () => {
    const { turns } = parseGpx(DIST_FIXTURE)
    const segmentIdx = 99
    const next = turns.find(t => t.idx > segmentIdx) ?? turns[turns.length - 1]
    expect(next).toBe(turns[turns.length - 1])
  })
})

const NO_TURNS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <name>No Turns</name>
    <trkseg>
      <trkpt lat="50.000" lon="8.0"></trkpt>
      <trkpt lat="50.001" lon="8.0"></trkpt>
      <trkpt lat="50.002" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('GPX without rte tag (no turn instructions)', () => {
  it('returns empty turns array', () => {
    const { turns } = parseGpx(NO_TURNS_FIXTURE)
    expect(turns).toEqual([])
  })

  it('still parses track points correctly', () => {
    const { trackPoints } = parseGpx(NO_TURNS_FIXTURE)
    expect(trackPoints).toHaveLength(3)
    expect(trackPoints[0]).toEqual([50.0, 8.0])
  })

  it('distToNextTurn contains cumulative distance-to-end values', () => {
    const { trackPoints, distToNextTurn } = parseGpx(NO_TURNS_FIXTURE)
    expect(distToNextTurn).toHaveLength(3)
    // Last point: 0
    expect(distToNextTurn[2]).toBe(0)
    // Second-to-last: one segment
    expect(distToNextTurn[1]).toBeCloseTo(haversine(trackPoints[1], trackPoints[2]), 0)
    // First: two segments (distance to end)
    const expected = haversine(trackPoints[0], trackPoints[1]) + haversine(trackPoints[1], trackPoints[2])
    expect(distToNextTurn[0]).toBeCloseTo(expected, 0)
  })
})

describe('runtime distance formula', () => {
  it('gives correct distance when standing exactly on a track point', () => {
    const { trackPoints, distToNextTurn } = parseGpx(DIST_FIXTURE)
    // At segmentIdx=1, position=trackPoints[1], nextPtIdx=2
    const position = trackPoints[1]
    const nextPtIdx = 2
    const total = haversine(position, trackPoints[nextPtIdx]) + distToNextTurn[nextPtIdx]
    const expected = haversine(trackPoints[1], trackPoints[2]) + haversine(trackPoints[2], trackPoints[3])
    expect(total).toBeCloseTo(expected, 0)
  })

  it('gives zero extra distance when next point is the turn', () => {
    const { trackPoints, distToNextTurn } = parseGpx(DIST_FIXTURE)
    // At segmentIdx=2, nextPtIdx=3 which is the turn → distToNextTurn[3]=0
    const position = trackPoints[2]
    const nextPtIdx = 3
    const total = haversine(position, trackPoints[nextPtIdx]) + distToNextTurn[nextPtIdx]
    expect(distToNextTurn[3]).toBe(0)
    expect(total).toBeCloseTo(haversine(trackPoints[2], trackPoints[3]), 0)
  })
})
