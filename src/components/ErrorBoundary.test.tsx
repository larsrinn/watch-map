// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { ErrorBoundary } from './ErrorBoundary'

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return createElement('p', null, 'all good')
}

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  let root: ReturnType<typeof createRoot>
  act(() => { root = createRoot(container); root.render(element) })
  return { container, root: root! }
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when there is no error', () => {
    const { container } = render(
      createElement(ErrorBoundary, null,
        createElement('p', null, 'hello'))
    )
    expect(container.textContent).toBe('hello')
  })

  it('renders fallback UI when a child throws', () => {
    const { container } = render(
      createElement(ErrorBoundary, null,
        createElement(Thrower, { shouldThrow: true }))
    )
    expect(container.textContent).toContain('Something went wrong')
    expect(container.querySelector('button')?.textContent).toBe('Retry')
  })

  it('renders custom fallback when provided', () => {
    const fallback = createElement('p', null, 'custom error')
    const { container } = render(
      createElement(ErrorBoundary, { fallback },
        createElement(Thrower, { shouldThrow: true }))
    )
    expect(container.textContent).toBe('custom error')
  })

  it('recovers when retry is clicked', () => {
    const { container, root } = render(
      createElement(ErrorBoundary, null,
        createElement(Thrower, { shouldThrow: true }))
    )
    expect(container.textContent).toContain('Something went wrong')

    // Re-render with non-throwing child before clicking retry
    act(() => {
      root.render(
        createElement(ErrorBoundary, null,
          createElement(Thrower, { shouldThrow: false }))
      )
    })
    // Click retry to clear error state
    const retryBtn = container.querySelector('button')!
    act(() => { retryBtn.click() })

    expect(container.textContent).toBe('all good')
  })

  it('logs the error via console.error', () => {
    render(
      createElement(ErrorBoundary, null,
        createElement(Thrower, { shouldThrow: true }))
    )
    expect(console.error).toHaveBeenCalled()
  })
})
