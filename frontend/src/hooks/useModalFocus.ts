import { useEffect } from 'react'

// Keep the management drawer keyboard-modal and return focus to its opener.
export function useModalFocus(open: boolean) {
  useEffect(() => {
    if (!open) return
    const drawer = document.querySelector<HTMLElement>('.sidebar')
    if (!drawer) return
    const opener = document.activeElement as HTMLElement | null
    const background = Array.from(document.querySelectorAll<HTMLElement>('.orbit-topbar, .main-content, .mobile-bottom-nav'))
    const previous = background.map(el => el.inert)
    background.forEach(el => { el.inert = true })
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(el => !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
    ;(focusable()[0] || drawer).focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); drawer.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      background.forEach((el, i) => { el.inert = previous[i] })
      document.body.style.overflow = original
      if (opener?.isConnected) opener.focus()
    }
  }, [open])
}
