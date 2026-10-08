import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

interface MultiSelectProps {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  disabled?: boolean
  ariaLabel: string
}

export default function MultiSelect({ options, value, onChange, placeholder, disabled = false, ariaLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    // Escape closes the list and returns focus to the trigger.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  }

  // Arrow keys move through the options; ArrowDown on the trigger opens the list.
  const onRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if (!open) {
      if (event.target === triggerRef.current && event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
        window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>('.multi-select-menu button')?.focus(), 0)
      }
      return
    }
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.multi-select-menu button') ?? [])
    if (items.length === 0) return
    event.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1)
    items[next].focus()
  }

  return (
    <div className="multi-select" ref={rootRef} onKeyDown={onRootKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="multi-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value.length ? '' : 'multi-select-placeholder'}>
          {value.length ? `${value.length} נבחרו` : placeholder}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="multi-select-menu" role="listbox" aria-multiselectable="true">
          {value.length > 0 && (
            <button type="button" className="multi-select-clear" onClick={() => onChange([])}>
              <X size={14} /> ניקוי הבחירה
            </button>
          )}
          {options.length ? options.map((option) => {
            const selected = value.includes(option)
            return (
              <button
                type="button"
                key={option}
                role="option"
                aria-selected={selected}
                className={`multi-select-option ${selected ? 'selected' : ''}`}
                onClick={() => toggle(option)}
              >
                <span className="multi-select-check">{selected && <Check size={14} />}</span>
                <span>{option}</span>
              </button>
            )
          }) : <span className="multi-select-empty">אין תתי-קטגוריות זמינות</span>}
        </div>
      )}
      {value.length > 0 && (
        <div className="multi-select-chips" aria-label="תתי-קטגוריות שנבחרו">
          {value.map((item) => (
            <button type="button" key={item} onClick={() => toggle(item)} title={`הסרת ${item}`}>
              {item} <X size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
