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

// Reference-counted body scroll lock: nested overlays must not unlock the
// page while another overlay is still open.
let lockCount = 0
let savedOverflow: string | null = null

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && savedOverflow !== null) {
    document.body.style.overflow = savedOverflow
    savedOverflow = null
  }
}
