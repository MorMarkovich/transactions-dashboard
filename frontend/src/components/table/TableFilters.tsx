import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Download, X } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import './TableFilters.css'

interface TableFiltersProps {
  onFilterChange: (filters: { search?: string; category?: string }) => void
  categories: string[]
  onExport: () => void
  loading?: boolean
}

const DEBOUNCE_MS = 300

export default function TableFilters({
  onFilterChange,
  categories,
  onExport,
  loading = false,
}: TableFiltersProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasActiveFilters = search.length > 0 || category.length > 0

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        onFilterChange({
          search: value || undefined,
          category: category || undefined,
        })
      }, DEBOUNCE_MS)
    },
    [category, onFilterChange],
  )

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategory(value)

      // Cancel any pending search debounce and fire immediately
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      onFilterChange({
        search: search || undefined,
        category: value || undefined,
      })
    },
    [search, onFilterChange],
  )

  const handleClearFilters = useCallback(() => {
    setSearch('')
    setCategory('')

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    onFilterChange({ search: undefined, category: undefined })
  }, [onFilterChange])

  const categoryOptions = [
    { value: '', label: 'כל הקטגוריות' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ]

  return (
    <div className="table-filters">
      <div className="filters-row">
        <div style={{ flex: 1, minWidth: '200px' }}>
          <Input
            placeholder="חיפוש עסקה..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            icon={<Search size={16} />}
            size="md"
            aria-label="חיפוש עסקאות"
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <Select
            options={categoryOptions}
            value={category}
            onChange={handleCategoryChange}
            placeholder="בחר קטגוריה"
          />
        </div>

        <Button
          variant="secondary"
          size="md"
          icon={<Download size={16} />}
          onClick={onExport}
          loading={loading}
        >
          ייצוא
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="md"
            icon={<X size={16} />}
            onClick={handleClearFilters}
          >
            נקה סינון
          </Button>
        )}
      </div>
    </div>
  )
}
