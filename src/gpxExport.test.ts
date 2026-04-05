import { describe, it, expect } from 'vitest'
import { exportGpx } from './gpxExport'
import type { RecordedPoint } from './types'

const point: RecordedPoint = { lat: 48.8566, lon: 2.3522, alt: 35, ts: 1700000000000 }

describe('exportGpx', () => {
  it('produces valid GPX with track points', () => {
    const gpx = exportGpx([point], 'My Track')
    expect(gpx).toContain('<?xml version="1.0"')
    expect(gpx).toContain('<trkpt lat="48.8566" lon="2.3522">')
    expect(gpx).toContain('<ele>35</ele>')
    expect(gpx).toContain('<name>My Track</name>')
  })

  it('omits ele when alt is null', () => {
    const p: RecordedPoint = { ...point, alt: null }
    const gpx = exportGpx([p])
    expect(gpx).not.toContain('<ele>')
  })

  it('escapes XML special characters in track name', () => {
    const gpx = exportGpx([point], 'Tom & Jerry <"best"> trail')
    expect(gpx).toContain('Tom &amp; Jerry &lt;&quot;best&quot;&gt; trail')
    expect(gpx).not.toContain('Tom & Jerry')
  })

  it('uses default track name when none provided', () => {
    const gpx = exportGpx([point])
    expect(gpx).toContain('<name>Recorded Track</name>')
  })
})
