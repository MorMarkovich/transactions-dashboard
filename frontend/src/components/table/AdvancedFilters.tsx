import { useState, useCallback, useEffect } from 'react'
import { Search, Filter, Download, X, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
}

const PRESETS_KEY = 'txn-filter-presets'

interface SavedPreset {
  name: string
  filters: Record<string, string | number | undefined>
}

export default function AdvancedFilters({
  onFilterChange,
  onExport,
  categories,
  loading = false,
}: AdvancedFiltersProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [presetName, setPresetName] = useState('')

  // Load saved presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESETS_KEY)
      if (saved) setPresets(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      emitFilters()
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const emitFilters = useCallback(() => {
    onFilterChange({
      search: search || undefined,
      category: category || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
    })
  }, [search, category, startDate, endDate, minAmount, maxAmount, onFilterChange])

  const handleApply = () => {
    emitFilters()
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
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
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
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
  }

  return (
    <div style={{ direction: 'rtl', marginBottom: 'var(--space-md)' }}>
      {/* Primary row: search + category + toggle + export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש עסקאות..."
            icon={<Search size={16} />}
          />
        </div>

        {/* Category dropdown */}
        <div style={{ position: 'relative', minWidth: '140px' }}>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setTimeout(handleApply, 0)
            }}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px',
              paddingLeft: '28px',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input, var(--bg-card))',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-family)',
              appearance: 'none',
              cursor: 'pointer',
              direction: 'rtl',
            }}
          >
            <option value="">כל הקטגוריות</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--text-muted)',
            }}
          />
        </div>

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
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
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

              {/* Apply button */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
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
