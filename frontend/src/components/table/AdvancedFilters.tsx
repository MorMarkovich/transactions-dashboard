import { useState, useCallback, useEffect, useRef, useContext } from 'react'
import { AuthContext } from '../../lib/AuthContext'
import { scoped, PRESETS_BASE } from '../../lib/userStorage'
import { Search, Filter, Download, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface AdvancedFiltersProps {
  onFilterChange: (filters: {
    search?: string
    category?: string
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
  }) => void
  onExport?: () => void
  categories: string[]
  loading?: boolean
  showCategory?: boolean
  /** Filters to start from (restored view when coming back to the page). */
  initial?: {
    search?: string
    category?: string
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
  }
}

// Presets are per-user (scoped with the account id) so a second account on
// the same browser never sees the first account's saved filters. The legacy
// global key migrates once via migrateUserState.

/** Non-empty amount text that is not a valid non-negative number (e.g. a
    negative value, or invalid text some mobile keyboards let through). */
export function isInvalidAmountInput(v: string): boolean {
  return v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)
}

interface SavedPreset {
  name: string
  filters: Record<string, string | number | undefined>
}

export default function AdvancedFilters({
  onFilterChange,
  onExport,
  categories,
  loading = false,
  showCategory = true,
  initial,
}: AdvancedFiltersProps) {
  const [search, setSearch] = useState(initial?.search ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [minAmount, setMinAmount] = useState(initial?.minAmount != null ? String(initial.minAmount) : '')
  const [maxAmount, setMaxAmount] = useState(initial?.maxAmount != null ? String(initial.maxAmount) : '')
  const [expanded, setExpanded] = useState(false)
  const firstRun = useRef(true)
  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const auth = useContext(AuthContext)
  const presetsKey = auth?.user ? scoped(PRESETS_BASE, auth.user.id) : null

  // Load saved presets from localStorage (per signed-in user)
  useEffect(() => {
    if (!presetsKey) { setPresets([]); return }
    try {
      const saved = localStorage.getItem(presetsKey)
      setPresets(saved ? JSON.parse(saved) : [])
    } catch { /* ignore */ }
  }, [presetsKey])

  // Debounced search
  useEffect(() => {
    // Mounting must not emit: it would wipe the restored filters.
    if (firstRun.current) { firstRun.current = false; return }
    const timer = setTimeout(() => {
      emitFilters()
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Always emit the LATEST field values: a debounce timer scheduled before a
  // quick date-chip click must not fire with the pre-chip dates.
  const latest = useRef({ search, category, startDate, endDate, minAmount, maxAmount })
  latest.current = { search, category, startDate, endDate, minAmount, maxAmount }
  const emitFilters = useCallback(() => {
    const current = latest.current
    onFilterChange({
      search: current.search || undefined,
      category: current.category || undefined,
      startDate: current.startDate || undefined,
      endDate: current.endDate || undefined,
      minAmount: current.minAmount ? Number(current.minAmount) : undefined,
      maxAmount: current.maxAmount ? Number(current.maxAmount) : undefined,
    })
  }, [onFilterChange])

  const [rangeNote, setRangeNote] = useState('')
  const handleApply = () => {
    if ([minAmount, maxAmount].some(isInvalidAmountInput)) {
      setRangeNote('נא להזין סכומים חיוביים תקינים')
      return
    }
    const notes: string[] = []
    let mn = minAmount, mx = maxAmount, sd = startDate, ed = endDate
    if (mn !== '' && mx !== '' && Number(mn) > Number(mx)) {
      ;[mn, mx] = [mx, mn]
      setMinAmount(mn); setMaxAmount(mx)
      notes.push('טווח הסכומים היה הפוך - החלפנו בין המינימום למקסימום')
    }
    if (sd && ed && sd > ed) {
      ;[sd, ed] = [ed, sd]
      setStartDate(sd); setEndDate(ed)
      notes.push('טווח התאריכים היה הפוך - החלפנו בין תאריך ההתחלה לסיום')
    }
    setRangeNote(notes.join(' · '))
    onFilterChange({
      search: search || undefined,
      category: category || undefined,
      startDate: sd || undefined,
      endDate: ed || undefined,
      minAmount: mn !== '' ? Number(mn) : undefined,
      maxAmount: mx !== '' ? Number(mx) : undefined,
    })
  }

  const handleReset = () => {
    setSearch('')
    setCategory('')
    setStartDate('')
    setEndDate('')
    setMinAmount('')
    setMaxAmount('')
    onFilterChange({})
  }

  const hasActiveFilters = !!(search || category || startDate || endDate || minAmount || maxAmount)

  const savePreset = () => {
    if (!presetName.trim()) return
    const newPreset: SavedPreset = {
      name: presetName.trim(),
      filters: { search, category, startDate, endDate, minAmount: minAmount ? Number(minAmount) : undefined, maxAmount: maxAmount ? Number(maxAmount) : undefined },
    }
    const updated = [...presets.filter(p => p.name !== newPreset.name), newPreset]
    setPresets(updated)
    if (presetsKey) localStorage.setItem(presetsKey, JSON.stringify(updated))
    setPresetName('')
  }

  const loadPreset = (preset: SavedPreset) => {
    setSearch((preset.filters.search as string) || '')
    setCategory((preset.filters.category as string) || '')
    setStartDate((preset.filters.startDate as string) || '')
    setEndDate((preset.filters.endDate as string) || '')
    setMinAmount(preset.filters.minAmount != null ? String(preset.filters.minAmount) : '')
    setMaxAmount(preset.filters.maxAmount != null ? String(preset.filters.maxAmount) : '')
    onFilterChange({
      search: (preset.filters.search as string) || undefined,
      category: (preset.filters.category as string) || undefined,
      startDate: (preset.filters.startDate as string) || undefined,
      endDate: (preset.filters.endDate as string) || undefined,
      minAmount: preset.filters.minAmount as number | undefined,
      maxAmount: preset.filters.maxAmount as number | undefined,
    })
  }

  const deletePreset = (name: string) => {
    const updated = presets.filter(p => p.name !== name)
    setPresets(updated)
    if (presetsKey) localStorage.setItem(presetsKey, JSON.stringify(updated))
  }

  return (
    <div style={{ direction: 'rtl', marginBottom: 'var(--space-md)' }}>
      {/* Primary row: search + category + toggle + export */}
      <div
        className="advanced-filters-primary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div className="advanced-filter-search" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש עסקאות..."
            aria-label="חיפוש עסקאות"
            icon={<Search size={16} />}
          />
        </div>

        {/* Category lives in the shared persistent filter bar on Transactions. */}
        {showCategory && <div className="advanced-filter-select" style={{ position: 'relative', minWidth: '140px' }}>
          <Select
            ariaLabel="קטגוריה"
            options={[{ value: '', label: 'כל הקטגוריות' }, ...categories.map((cat) => ({ value: cat, label: cat }))]}
            value={category}
            onChange={(newCat) => {
              setCategory(newCat)
              onFilterChange({
                search: search || undefined,
                category: newCat || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                minAmount: minAmount ? Number(minAmount) : undefined,
                maxAmount: maxAmount ? Number(maxAmount) : undefined,
              })
            }}
          />
        </div>}

        {/* Advanced toggle */}
        <Button
          variant={expanded ? 'primary' : 'secondary'}
          size="sm"
          icon={<Filter size={14} />}
          onClick={() => setExpanded((v) => !v)}
        >
          מתקדם
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={handleReset}>
            נקה
          </Button>
        )}

        {/* Export */}
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={onExport}
            disabled={loading}
          >
            ייצוא
          </Button>
        )}
      </div>

      {/* Expanded filters panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="glass-card"
              style={{
                marginTop: 'var(--space-sm)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
              }}
            >
              {/* Date range */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  טווח תאריכים
                </label>
                <div className="advanced-filter-range-row" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input
                    type="date"
                    lang="he-IL"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    style={{
                      flex: 1,
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-family)',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>עד</span>
                  <input
                    type="date"
                    lang="he-IL"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    style={{
                      flex: 1,
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-family)',
                    }}
                  />
                </div>
              </div>

              {/* Amount range */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  טווח סכומים
                </label>
                <div className="advanced-filter-range-row" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="מינימום"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    style={{
                      flex: 1,
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>עד</span>
                  <input
                    type="number"
                    placeholder="מקסימום"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    style={{
                      flex: 1,
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>

              {rangeNote && (
                <div role="status" style={{ fontSize: '0.75rem', color: 'var(--warning, #f5a524)' }}>{rangeNote}</div>
              )}

              {/* Apply button */}
              <div className="advanced-filter-actions" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <Button variant="primary" size="sm" onClick={handleApply}>
                  החל סינון
                </Button>

                {/* Save preset */}
                <input
                  type="text"
                  placeholder="שם פריסט..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input, var(--bg-card))',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-family)',
                    width: '120px',
                  }}
                />
                <Button variant="secondary" size="sm" onClick={savePreset} disabled={!presetName.trim()}>
                  שמור
                </Button>
              </div>

              {/* Saved presets */}
              {presets.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    פריסטים שמורים
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {presets.map((preset) => (
                      <div
                        key={preset.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span onClick={() => loadPreset(preset)}>{preset.name}</span>
                        <button
                          onClick={() => deletePreset(preset.name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            fontSize: '0.625rem',
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
                  }
