import { useEffect, useRef, type RefObject, type TouchEvent } from 'react'

/**
 * Recharts 3 updates cartesian ("axis"-type) tooltips from mousemove only —
 * its touch path listens to touchmove, so a tap without a drag may never
 * update the tooltip (iOS Safari emits no compatibility mousemove for taps).
 * Pie charts are unaffected (item tooltips fire from sector mouseover).
 *
 * Attach this as onTouchStart on the element wrapping a cartesian chart. It
 * re-emits the tap as a bubbling mousemove from the touched node, so the
 * chart's own mousemove handling retargets the tooltip on every tap. Where
 * the browser also emits compatibility mouse events for the same tap they
 * re-set the identical state — the duplicate is harmless. Desktop hover is
 * untouched.
 */

// One bridged tap makes Chromium end that tap with exactly one phantom
// mouseout at client (0,0) (there is no cursor to leave anywhere). The guard
// below swallows one phantom per bridged tap, keyed to the wrapper element.
type PhantomCredit = { count: number; at: number }
const phantomCredits = new WeakMap<HTMLElement, PhantomCredit>()
const PHANTOM_WINDOW_MS = 1500

export function bridgeTouchToMouseMove(e: TouchEvent<HTMLElement>): void {
  const touch = e.touches[0]
  const target = e.target as HTMLElement | null
  if (!touch || !target || typeof target.dispatchEvent !== 'function') return
  const root = (e.currentTarget as HTMLElement | null) ?? target
  const prev = phantomCredits.get(root)
  const now = Date.now()
  const count = prev && now - prev.at < PHANTOM_WINDOW_MS ? prev.count : 0
  phantomCredits.set(root, { count: count + 1, at: now })
  target.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
    }),
  )
}

function consumePhantomCredit(el: HTMLElement): boolean {
  const now = Date.now()
  const credit = phantomCredits.get(el)
  if (!credit || credit.count <= 0 || now - credit.at >= PHANTOM_WINDOW_MS) return false
  phantomCredits.set(el, { count: credit.count - 1, at: credit.at })
  return true
}

/**
 * Chromium's touch pipeline ends each tap with a phantom mouseout/mouseleave
 * at client (0,0). Recharts treats it as the pointer leaving the chart and
 * hides a tap-shown tooltip a beat later — the "tooltip stuck / next tap
 * shows nothing" behavior seen on mobile. Swallow only the phantom paired
 * with a bridged tap on this chart:
 *  - a genuine desktop hover-out carries real coordinates and passes through.
 * Because the swallowed phantom also clears the browser's own hover state,
 * the hook additionally listens for touches starting outside the chart and
 * re-emits a real-coordinates mouseout on the chart wrapper, so tapping
 * elsewhere dismisses a tap-shown tooltip exactly like desktop hover-out.
 *
 * Attach the returned ref to the same wrapper element that gets
 * bridgeTouchToMouseMove.
 */
export function usePhantomMouseOutGuard<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const guard = (e: MouseEvent) => {
      if (e.clientX !== 0 || e.clientY !== 0) return
      if (consumePhantomCredit(el)) e.stopPropagation()
    }
    // The swallowed phantom also clears the browser's own hover state, so a
    // later outside tap produces no mouseout for recharts at all. Dismiss a
    // tap-shown tooltip ourselves: a touch starting outside this chart
    // re-emits a real-coordinates mouseout on the chart wrapper, which
    // recharts treats exactly like a pointer leaving (hover-out on desktop).
    const onDocTouchStart = (e: globalThis.TouchEvent) => {
      if (e.target && el.contains(e.target as Node)) return
      const chart = el.querySelector('.recharts-wrapper') ?? el.firstElementChild ?? el
      chart.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          cancelable: true,
          clientX: e.touches?.[0]?.clientX ?? 0,
          clientY: e.touches?.[0]?.clientY ?? 0,
          relatedTarget: document.body,
        }),
      )
    }
    el.addEventListener('mouseout', guard, true)
    document.addEventListener('touchstart', onDocTouchStart, { passive: true })
    return () => {
      el.removeEventListener('mouseout', guard, true)
      document.removeEventListener('touchstart', onDocTouchStart)
    }
  }, [])
  return ref
}
