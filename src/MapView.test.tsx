// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { TileLayer } from './MapView'

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
    _failed = false
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
