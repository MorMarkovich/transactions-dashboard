import { useRef, useEffect, useState, useCallback } from 'react'
import { useInView } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatter?: (value: number) => string
  className?: string
  style?: React.CSSProperties
}

export default function AnimatedNumber({
  value,
  duration = 800,
  formatter = (v) => v.toLocaleString('he-IL'),
  className = '',
  style,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [displayValue, setDisplayValue] = useState(0)
  const prevValue = useRef(0)

  const animate = useCallback(
    (from: number, to: number) => {
      const start = performance.now()
      const diff = to - from

      const step = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = from + diff * eased

        setDisplayValue(current)

        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          setDisplayValue(to)
          prevValue.current = to
        }
      }
      requestAnimationFrame(step)
    },
    [duration],
  )

  useEffect(() => {
    if (isInView) {
      animate(prevValue.current, value)
    }
  }, [isInView, value, animate])

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <span
      ref={ref}
      className={`font-mono-numbers ${className}`}
      style={{
        fontVariantNumeric: 'tabular-nums',
        direction: 'ltr',
        unicodeBidi: 'embed' as const,
        display: 'inline-block',
        ...style,
      }}
    >
      {prefersReducedMotion || !isInView ? formatter(value) : formatter(displayValue)}
    </span>
  )
}
