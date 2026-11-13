import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './MobilePickerSheet.css'

export default function MobilePickerSheet({ label, onDismiss, children }: {
  label: string
  onDismiss: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => element.close()
  }, [])

  return createPortal(
    <dialog
      ref={dialog}
      className="mobile-picker-sheet"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }}
    >
      <div className="mobile-picker-backdrop" aria-hidden="true" onClick={onDismiss} />
      <div className="mobile-picker-panel">
        <header>
          <h2>{label}</h2>
          <button type="button" aria-label="סגור" onClick={onDismiss}><X size={20} /></button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  )
}
