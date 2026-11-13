import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import MobilePickerSheet from './MobilePickerSheet'
import useMobilePicker from '../../hooks/useMobilePicker'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
  searchable?: boolean
}

const SEARCH_THRESHOLD = 12
const MENU_MAX_HEIGHT = 280
const VIEWPORT_MARGIN = 8

/**
 * Custom dropdown select: themed open menu (no native OS popup), RTL aligned,
 * keyboard navigable, searchable when the option list is long, and positioned
 * against the viewport so it never clips or collides with screen edges.
 */
export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder,
  className = '',
  ariaLabel,
  disabled = false,
  searchable: searchableProp,
}: SelectProps) {
  const generatedId = useId()
  const mobilePicker = useMobilePicker()
  const listboxId = `${generatedId}-listbox`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  // Starts offscreen: the portaled menu's static spot is the end of <body>,
  // and we never want it (or focus inside it) to scroll the page there.
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: -9999, left: -9999, visibility: 'hidden',
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const searchable = searchableProp ?? options.length > SEARCH_THRESHOLD
  const trimmedQuery = query.trim().toLowerCase()
  const filtered = trimmedQuery
    ? options.filter((opt) => opt.label.toLowerCase().includes(trimmedQuery))
    : options
  const selected = options.find((opt) => opt.value === value)
  const resolvedLabel = ariaLabel ?? label ?? placeholder ?? 'בחירה'

  const optionId = (index: number) => `${generatedId}-option-${index}`

  const close = (refocus = false) => {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }

  const choose = (option: SelectOption) => {
    onChange(option.value)
    close(!mobilePicker)
  }

  // Position the menu against the viewport: flip above the trigger when there
  // is more room above, clamp inside the screen horizontally, cap the height.
  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    // The visual viewport shrinks when the mobile OS keyboard opens; measure
    // against it so the menu stays usable on small-height screens.
    const vv = window.visualViewport
    const vw = vv ? vv.width : window.innerWidth
    const vh = vv ? vv.height : window.innerHeight
    // Keep clear of the app's fixed mobile bottom navigation when shown.
    const bottomNav = document.querySelector('.mobile-bottom-nav')
    const navInset =
      bottomNav && getComputedStyle(bottomNav).display !== 'none'
        ? bottomNav.getBoundingClientRect().height + 6
        : 0
    const spaceBelow = vh - rect.bottom - VIEWPORT_MARGIN - navInset
    const spaceAbove = rect.top - VIEWPORT_MARGIN
    const flip = spaceBelow < 200 && spaceAbove > spaceBelow
    const available = Math.max(80, (flip ? spaceAbove : spaceBelow) - 6)
    const width = Math.min(Math.max(rect.width, 260), vw - VIEWPORT_MARGIN * 2, 560)
    let left = rect.right - width // inline-end alignment (right edge in RTL)
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - VIEWPORT_MARGIN - width))
    setMenuStyle(
      flip
        ? { position: 'fixed', left, width, bottom: vh - rect.top + 6, maxHeight: Math.min(MENU_MAX_HEIGHT, available), zIndex: 60, visibility: 'visible' }
        : { position: 'fixed', left, width, top: rect.bottom + 6, maxHeight: Math.min(MENU_MAX_HEIGHT, available), zIndex: 60, visibility: 'visible' },
    )
  }

  useLayoutEffect(() => {
    if (!open) return
    const selectedIndex = filtered.findIndex((opt) => opt.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    if (mobilePicker) return
    updatePosition()
    // The menu's first frame is offscreen and visibility:hidden, and browsers
    // ignore focus() on a hidden element, so the search input only becomes
    // focusable after the positioned frame commits. Defer to rAF - React
    // flushes the position state synchronously before the next paint.
    const focusRaf = searchable
      ? requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
      : null
    const reposition = () => updatePosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    window.visualViewport?.addEventListener('resize', reposition)
    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      window.visualViewport?.removeEventListener('resize', reposition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mobilePicker])

  useEffect(() => {
    if (!open || mobilePicker) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, mobilePicker])

  // Keep the highlighted option visible while moving with the keyboard.
  useEffect(() => {
    if (!open) return
    const node = menuRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex))}`)
    const list = node?.parentElement
    if (!node || !list) return
    const item = node.getBoundingClientRect()
    const viewport = list.getBoundingClientRect()
    if (item.top < viewport.top) list.scrollTop += item.top - viewport.top
    else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open, filtered.length])

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return
    setActiveIndex((current) => (current + delta + filtered.length) % filtered.length)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(-1)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(filtered.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        if (filtered[activeIndex]) choose(filtered[activeIndex])
        break
      case ' ':
        // Space belongs to the search text when typing in the filter input.
        if (event.target === searchRef.current) break
        event.preventDefault()
        if (filtered[activeIndex]) choose(filtered[activeIndex])
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(!mobilePicker)
        break
      case 'Tab':
        if (!mobilePicker) close()
        break
      default:
        break
    }
  }

  const activeDescendant = open && filtered[activeIndex] ? optionId(activeIndex) : undefined

  const menu = (
    <div
      className="ui-select-menu"
      id={listboxId}
      role="listbox"
      aria-label={resolvedLabel}
      ref={menuRef}
      style={mobilePicker ? undefined : menuStyle}
      onKeyDown={mobilePicker ? (event) => { if (!(event.target instanceof HTMLButtonElement)) onKeyDown(event) } : undefined}
    >
      {searchable && (
        <div className="ui-select-search-row">
          <Search size={14} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={mobilePicker ? undefined : onKeyDown}
            placeholder="חיפוש..."
            aria-label={`חיפוש בתוך ${resolvedLabel}`}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            autoComplete="off"
          />
        </div>
      )}
      <div className="ui-select-options">
        {filtered.length === 0 ? (
          <div className="ui-select-empty">אין תוצאות תואמות</div>
        ) : (
          filtered.map((option, index) => {
            const isSelected = option.value === value
            return (
              <button
                type="button"
                key={option.value === '' ? '__empty__' : option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                className={`ui-select-option${isSelected ? ' selected' : ''}${index === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span className="ui-select-option-check" aria-hidden="true">
                  {isSelected && <Check size={14} />}
                </span>
                <span className="ui-select-option-label">{option.label}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div className={`ui-select-wrapper ${className}`} ref={rootRef}>
      {label && (
        <label className="ui-select-label" htmlFor={generatedId}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={generatedId}
        ref={triggerRef}
        className={`ui-select-trigger${open ? ' open' : ''}`}
        role={mobilePicker ? undefined : 'combobox'}
        aria-haspopup={mobilePicker ? 'dialog' : 'listbox'}
        aria-expanded={open}
        aria-controls={open && !mobilePicker ? listboxId : undefined}
        aria-activedescendant={!mobilePicker && !searchable ? activeDescendant : undefined}
        aria-label={resolvedLabel}
        disabled={disabled}
        title={selected ? selected.label : undefined}
        onClick={() => (open ? close(true) : !disabled && setOpen(true))}
        onKeyDown={onKeyDown}
      >
        <span className={`ui-select-value${selected ? '' : ' ui-select-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="ui-select-chevron" aria-hidden="true" />
      </button>
      {open && !disabled && (mobilePicker
        ? <MobilePickerSheet label={resolvedLabel} onDismiss={() => close()}>{menu}</MobilePickerSheet>
        : createPortal(menu, document.body))}
    </div>
  )
}
