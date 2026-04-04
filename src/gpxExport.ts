import type { RecordedPoint } from './types'

export function exportGpx(points: RecordedPoint[], trackName = 'Recorded Track'): string {
  const firstTime = points[0] ? new Date(points[0].ts).toISOString() : new Date().toISOString()
  const trkpts = points.map(p => {
    const ele = p.alt !== null ? `\n        <ele>${p.alt}</ele>` : ''
    return `      <trkpt lat="${p.lat}" lon="${p.lon}">${ele}\n        <time>${new Date(p.ts).toISOString()}</time>\n      </trkpt>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="watch-nav">
  <metadata><name>${trackName}</name><time>${firstTime}</time></metadata>
  <trk>
    <name>${trackName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}
