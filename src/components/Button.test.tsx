// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { Button } from './Button'

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  let root: ReturnType<typeof createRoot>
  act(() => { root = createRoot(container); root.render(element) })
  return { container, root: root! }
}

describe('Button', () => {
  it('renders children', () => {
    const { container } = render(createElement(Button, null, 'Klick'))
    expect(container.querySelector('button')?.textContent).toBe('Klick')
  })

  it('applies default neutral variant class', () => {
    const { container } = render(createElement(Button, null, 'Test'))
    const btn = container.querySelector('button')!
    expect(btn.className).toContain('btn')
    expect(btn.className).toContain('btn--neutral')
  })

  it('applies specified variant class', () => {
    const { container } = render(createElement(Button, { variant: 'primary' }, 'Test'))
    expect(container.querySelector('button')!.className).toContain('btn--primary')
  })

  it('applies additional className', () => {
    const { container } = render(createElement(Button, { className: 'control-btn', variant: 'success' }, 'Test'))
    const btn = container.querySelector('button')!
    expect(btn.className).toContain('btn--success')
    expect(btn.className).toContain('control-btn')
  })

  it('forwards onClick handler', () => {
    const onClick = vi.fn()
    const { container } = render(createElement(Button, { onClick }, 'Klick'))
    act(() => { container.querySelector('button')!.click() })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('supports disabled state', () => {
    const onClick = vi.fn()
    const { container } = render(createElement(Button, { disabled: true, onClick }, 'Klick'))
    const btn = container.querySelector('button')!
    expect(btn.disabled).toBe(true)
  })
})
