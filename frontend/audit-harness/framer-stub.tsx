/* eslint-disable @typescript-eslint/no-explicit-any -- audit harness stub: the framer-motion proxy is intentionally untyped */
import React from 'react'
const STRIP = new Set(['initial','animate','exit','variants','custom','layout','layoutId','transition','whileHover','whileTap','whileFocus','whileInView','drag','dragConstraints','onAnimationComplete','mode'])
function clean(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) if (!STRIP.has(k)) out[k] = v
  return out
}
export const motion = new Proxy({}, {
  get: (_, tag: string) => (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(tag as any, clean(props) as any, props.children),
})
export const AnimatePresence = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const MotionConfig = ({ children }: { children?: React.ReactNode }) => <>{children}</>
