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
