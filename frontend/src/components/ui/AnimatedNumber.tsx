import { useRef, useEffect, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatter?: (value: number) => string
  className?: string
  style?: React.CSSProperties
}

/**
 * Display `value` with an optional ease-out tween between updates.
 *
 * Previous implementation had two bugs that produced non-deterministic
 * counters (e.g. Booking.com showing ₪6,621 → ₪8,674 → ₪8,866 on three
 * back-to-back screenshots):
 *   1. No cancelAnimationFrame on prop changes → every value update spawned
 *      a new RAF loop while the old one kept running, so multiple
 *      animations fought for setDisplayValue.
 *   2. Animated from 0 → value on first render even when `value` was
 *      already known, so brief screenshots caught the count-up partway
 *      and looked like the data was wrong.
 *
 * This rewrite keeps the same surface API but:
 *   - Initialises displayValue to `value` (no 0 → value count-up).
 *   - Tweens from the *currently displayed* value to the new value when
 *     it changes, never from a stale prevValue.
 *   - Tracks the active RAF id in a ref and cancels it on every update +
 *     on unmount, so only one tween is alive at a time.
 *   - Skips the animation entirely if the delta is tiny (< 0.5 NIS) or
 *     if reduced-motion is preferred.
 */
export default function AnimatedNumber({
  value,
  duration = 600,
  formatter = (v) => v.toLocaleString('he-IL'),
  className = '',
  style,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const displayRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const from = displayRef.current
    const to = value
    if (prefersReducedMotion || Math.abs(to - from) < 0.5) {
      displayRef.current = to
      setDisplayValue(to)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased
      displayRef.current = current
      setDisplayValue(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        displayRef.current = to
        setDisplayValue(to)
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [value, duration, prefersReducedMotion])

  return (
    <span
      className={`font-mono-numbers ${className}`}
      style={{
        fontVariantNumeric: 'tabular-nums',
        direction: 'ltr',
        unicodeBidi: 'embed' as const,
        display: 'inline-block',
        ...style,
      }}
    >
      {formatter(Number.isInteger(value) ? Math.round(displayValue) : displayValue)}
    </span>
  )
}
