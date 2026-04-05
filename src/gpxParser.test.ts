// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { parseGpx } from './gpxParser'

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

const MALFORMED_COORDS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <name>Bad Coords</name>
    <trkseg>
      <trkpt lat="50.0" lon="8.0"></trkpt>
      <trkpt lon="8.1"></trkpt>
      <trkpt lat="50.2"></trkpt>
      <trkpt lat="" lon="8.3"></trkpt>
      <trkpt lat="50.4" lon="8.4"></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('malformed coordinates', () => {
  it('filters out points with missing lat attribute', () => {
    const { trackPoints } = parseGpx(MALFORMED_COORDS_FIXTURE)
    expect(trackPoints).toEqual([
      [50.0, 8.0],
      [50.4, 8.4],
    ])
  })

  it('filters out points with missing lon attribute', () => {
    const { trackPoints } = parseGpx(MALFORMED_COORDS_FIXTURE)
    // point with lat=50.2 but no lon is excluded
    expect(trackPoints.find(p => p[0] === 50.2)).toBeUndefined()
  })

  it('filters out points with empty lat attribute', () => {
    const { trackPoints } = parseGpx(MALFORMED_COORDS_FIXTURE)
    // point with lat="" lon="8.3" is excluded
    expect(trackPoints.find(p => p[1] === 8.3)).toBeUndefined()
  })
})

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

})

