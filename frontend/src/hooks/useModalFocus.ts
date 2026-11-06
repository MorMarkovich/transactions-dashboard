import { useEffect } from 'react'
import { pushOverlay, removeOverlay, isTopOverlay, lockBodyScroll, unlockBodyScroll } from '../lib/overlayStack'

// Keep the management drawer keyboard-modal and return focus to its opener.
// Registers in the global overlay stack: Escape/Tab apply only while this
// drawer is the topmost overlay.
export function useModalFocus(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open) return
    const overlayId = pushOverlay()
    const drawer = document.querySelector<HTMLElement>('.sidebar')
    if (!drawer) return
    const opener = document.activeElement as HTMLElement | null
    const background = Array.from(document.querySelectorAll<HTMLElement>('.orbit-topbar, .main-content, .mobile-bottom-nav'))
    const previous = background.map(el => el.inert)
    background.forEach(el => { el.inert = true })
    lockBodyScroll()
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(el => !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
    ;(focusable()[0] || drawer).focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onClose && isTopOverlay(overlayId)) onClose()
        return
      }
      if (event.key !== 'Tab') return
      if (!isTopOverlay(overlayId)) return
      const items = focusable()
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); drawer.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      removeOverlay(overlayId)
      background.forEach((el, i) => { el.inert = previous[i] })
      unlockBodyScroll()
      if (opener?.isConnected) opener.focus()
    }
  }, [open, onClose])
}
