/**
 * Haversine distance between two [lat, lon] points, in meters.
 */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/**
 * Format a distance in meters for display.
 * < 100m  → "42 m"
 * < 300m  → "0,23 km" (2 decimals)
 * >= 300m → "1,4 km"  (1 decimal)
 */
export function formatDistance(meters: number): string {
  if (meters < 100) {
    return `${Math.round(meters).toLocaleString()} m`
  } else if (meters < 300) {
    return `${(meters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
  } else {
    return `${(meters / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  }
}
