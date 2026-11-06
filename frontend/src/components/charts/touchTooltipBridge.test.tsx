import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { bridgeTouchToMouseMove, usePhantomMouseOutGuard } from './touchTooltipBridge'
import type { TouchEvent } from 'react'

function fakeTouchEvent(
  touches: { clientX: number; clientY: number }[],
  target: HTMLElement,
  currentTarget?: HTMLElement,
): TouchEvent<HTMLElement> {
  return { touches, target, currentTarget: currentTarget ?? null } as unknown as TouchEvent<HTMLElement>
}

describe('bridgeTouchToMouseMove', () => {
  it('re-emits the tap as a bubbling mousemove from the touched node', () => {
    const child = document.createElement('span')
    const spy = vi.fn()
    child.addEventListener('mousemove', spy)
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 123, clientY: 456 }], child))
    expect(spy).toHaveBeenCalledTimes(1)
    const ev = spy.mock.calls[0][0] as MouseEvent
    expect(ev.clientX).toBe(123)
    expect(ev.clientY).toBe(456)
    expect(ev.bubbles).toBe(true)
  })

  it('bubbles up so an ancestor chart wrapper receives it', () => {
    const wrapper = document.createElement('div')
    const child = document.createElement('span')
    wrapper.appendChild(child)
    const spy = vi.fn()
    wrapper.addEventListener('mousemove', spy)
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 10, clientY: 20 }], child))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a touch point', () => {
    const child = document.createElement('span')
    const spy = vi.fn()
    child.addEventListener('mousemove', spy)
    bridgeTouchToMouseMove(fakeTouchEvent([], child))
    expect(spy).not.toHaveBeenCalled()
  })
})

function Guarded({ onOut }: { onOut: () => void }) {
  const ref = usePhantomMouseOutGuard<HTMLDivElement>()
  return (
    <div data-testid="wrap" ref={ref} onTouchStart={bridgeTouchToMouseMove}>
      <div data-testid="chart" onMouseOut={onOut}>
        <span data-testid="inner" />
      </div>
    </div>
  )
}

const phantom = new MouseEvent('mouseout', { bubbles: true, clientX: 0, clientY: 0 })
const realOut = new MouseEvent('mouseout', { bubbles: true, clientX: 120, clientY: 80 })

describe('usePhantomMouseOutGuard', () => {
  it('swallows the touch phantom mouseout at (0,0) paired with a bridged tap', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    const wrap = getByTestId('wrap')
    const inner = getByTestId('inner')
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 10, clientY: 20 }], inner, wrap))
    inner.dispatchEvent(phantom)
    expect(onOut).not.toHaveBeenCalled()
  })

  it('swallows only one phantom per bridged tap', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    const wrap = getByTestId('wrap')
    const inner = getByTestId('inner')
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 10, clientY: 20 }], inner, wrap))
    inner.dispatchEvent(phantom)
    inner.dispatchEvent(phantom)
    expect(onOut).toHaveBeenCalledTimes(1)
  })

  it('lets an outside-tap leave at (0,0) through when no tap was bridged (dismissal)', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    getByTestId('inner').dispatchEvent(phantom)
    expect(onOut).toHaveBeenCalledTimes(1)
  })

  it('dismisses a tap-shown tooltip when a touch starts outside the chart', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    const wrap = getByTestId('wrap')
    const inner = getByTestId('inner')
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 10, clientY: 20 }], inner, wrap))
    inner.dispatchEvent(phantom) // swallowed
    expect(onOut).not.toHaveBeenCalled()
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(onOut).toHaveBeenCalledTimes(1)
    const ev = onOut.mock.calls[0][0] as MouseEvent
    expect(ev.type).toBe('mouseout')
  })

  it('ignores touches starting inside the chart (bridge owns those)', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    const inner = getByTestId('inner')
    inner.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(onOut).not.toHaveBeenCalled()
  })

  it('lets a real mouseout with coordinates through (desktop hover-out)', () => {
    const onOut = vi.fn()
    const { getByTestId } = render(<Guarded onOut={onOut} />)
    const wrap = getByTestId('wrap')
    const inner = getByTestId('inner')
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 10, clientY: 20 }], inner, wrap))
    inner.dispatchEvent(realOut)
    expect(onOut).toHaveBeenCalledTimes(1)
  })

  it('does not cross credits between two chart wrappers', () => {
    const onOut = vi.fn()
    render(
      <>
        <Guarded onOut={onOut} />
        <Guarded onOut={onOut} />
      </>,
    )
    const wraps = document.querySelectorAll('[data-testid="wrap"]')
    const inners = document.querySelectorAll('[data-testid="inner"]')
    bridgeTouchToMouseMove(fakeTouchEvent([{ clientX: 1, clientY: 1 }], inners[0] as HTMLElement, wraps[0] as HTMLElement))
    inners[1].dispatchEvent(phantom)
    expect(onOut).toHaveBeenCalledTimes(1)
  })
})
