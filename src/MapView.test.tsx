// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { TileLayer, MapView } from './MapView'

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  let root: ReturnType<typeof createRoot>
  act(() => { root = createRoot(container); root.render(element) })
  return { container, root: root! }
}

// Capture img.onload callbacks so we can trigger them manually
let pendingOnloads: (() => void)[] = []

beforeEach(() => {
  pendingOnloads = []
  // Mock Image so we control when onload fires
  vi.stubGlobal('Image', class MockImage {
    src = ''
    crossOrigin = ''
    complete = false
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor() {
      // Capture onload after it's set (next microtask)
      setTimeout(() => {
        if (this.onload) {
          pendingOnloads.push(() => {
            this.complete = true
            this.onload!()
          })
        }
      }, 0)
    }
  })
})

describe('TileLayer', () => {
  it('renders tile images after they load', async () => {
    const center = { x: 512, y: 512 }
    const { container } = render(
      createElement(TileLayer, { zoom: 2, center })
    )

    // Before any tiles load, no img tags should appear (tiles aren't complete yet)
    const imgsBefore = container.querySelectorAll('img')
    expect(imgsBefore.length).toBe(0)

    // Flush setTimeout so onload callbacks are captured
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    // Trigger all pending tile loads
    act(() => { pendingOnloads.forEach(fn => fn()) })

    // Now tiles should be rendered
    const imgsAfter = container.querySelectorAll('img')
    expect(imgsAfter.length).toBeGreaterThan(0)
  })

  it('does not re-render parent when tiles load', async () => {
    const parentRenderCount = { value: 0 }

    function Parent() {
      parentRenderCount.value++
      const [center] = useState({ x: 512, y: 512 })
      return createElement('div', null,
        createElement('span', { className: 'parent-marker' }, `renders:${parentRenderCount.value}`),
        createElement(TileLayer, { zoom: 2, center })
      )
    }

    render(createElement(Parent))
    const initialRenders = parentRenderCount.value

    // Flush setTimeout so onload callbacks are captured
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    // Trigger all tile loads — this should only re-render TileLayer, not Parent
    act(() => { pendingOnloads.forEach(fn => fn()) })

    expect(parentRenderCount.value).toBe(initialRenders)
  })

  it('uses memo to skip re-renders when props are unchanged', () => {
    const center = { x: 512, y: 512 }
    const { container: c, root } = render(
      createElement(TileLayer, { zoom: 2, center })
    )

    const htmlBefore = c.innerHTML

    // Re-render with the same center object reference — memo should skip
    act(() => { root.render(createElement(TileLayer, { zoom: 2, center })) })

    expect(c.innerHTML).toBe(htmlBefore)
  })
})

const baseMapViewProps = {
  zoom: 15,
  currentPosition: [48.1, 11.5] as [number, number],
  followMode: true,
  offsetX: 0,
  offsetY: 0,
  trackPoints: [[48.1, 11.5], [48.101, 11.501], [48.102, 11.502]] as [number, number][],
  recordedPath: [
    { lat: 48.1, lon: 11.5, alt: 500, ts: Date.now() },
    { lat: 48.101, lon: 11.501, alt: 501, ts: Date.now() },
  ],
  sleeping: false,
  onSleepClick: () => {},
  currentTime: new Date(),
  navInstruction: null,
  showTrackDots: false,
  showTurnDots: false,
  turns: [],
}

describe('MapView track memoization', () => {
  it('uses g transform for track rendering instead of baking center into each point', () => {
    const { container } = render(createElement(MapView, baseMapViewProps))
    const trackSvg = container.querySelector('.track-svg')
    const gElements = trackSvg?.querySelectorAll('g[transform]')
    expect(gElements?.length).toBeGreaterThan(0)
  })

  it('track path d attribute stays the same when only position changes', () => {
    const props = { ...baseMapViewProps }
    const { container, root } = render(createElement(MapView, props))

    const getPathD = () => container.querySelector('.track-svg path')?.getAttribute('d')
    const pathBefore = getPathD()
    expect(pathBefore).toBeTruthy()

    // Change position (which changes center) but keep same trackPoints reference
    act(() => {
      root.render(createElement(MapView, {
        ...props,
        currentPosition: [48.105, 11.505] as [number, number],
      }))
    })

    const pathAfter = getPathD()
    // Path d should be identical — only the g transform changes
    expect(pathAfter).toBe(pathBefore)
  })

  it('track path d attribute changes when zoom changes', () => {
    const props = { ...baseMapViewProps }
    const { container, root } = render(createElement(MapView, props))

    const getPathD = () => container.querySelector('.track-svg path')?.getAttribute('d')
    const pathBefore = getPathD()

    act(() => {
      root.render(createElement(MapView, { ...props, zoom: 16 }))
    })

    const pathAfter = getPathD()
    expect(pathAfter).not.toBe(pathBefore)
  })

  it('g transform updates when position changes', () => {
    const props = { ...baseMapViewProps }
    const { container, root } = render(createElement(MapView, props))

    const getTransform = () => container.querySelector('.track-svg g')?.getAttribute('transform')
    const transformBefore = getTransform()

    act(() => {
      root.render(createElement(MapView, {
        ...props,
        currentPosition: [48.105, 11.505] as [number, number],
      }))
    })

    const transformAfter = getTransform()
    expect(transformAfter).not.toBe(transformBefore)
  })
})
