// Global stack of open overlays (modals, drawers, palettes). Escape and focus
// handling must affect only the topmost overlay so an overlay opened on top of
// another does not close or trap the one beneath.
const stack: string[] = []
let counter = 0

export function pushOverlay(): string {
  counter += 1
  const id = `overlay-${counter}`
  stack.push(id)
  return id
}

export function removeOverlay(id: string): void {
  const i = stack.lastIndexOf(id)
  if (i >= 0) stack.splice(i, 1)
}

export function isTopOverlay(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id
}

// Reference-counted scroll lock: nested overlays must not unlock the
// page while another overlay is still open.
// Locks the ROOT element, not body: the app CSS sets `overflow-x: hidden` on
// `html, body`, and a non-visible overflow on the root disables body-to-viewport
// overflow propagation, so setting overflow on body alone never actually locks
// the viewport (the page kept scrolling behind modals/drawers).
let lockCount = 0
let savedOverflow: string | null = null

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && savedOverflow !== null) {
    document.documentElement.style.overflow = savedOverflow
    savedOverflow = null
  }
}
