import { useState } from 'react'
import type { TransactionFilters } from '../../services/types'
import './TableFilters.css'

interface TableFiltersProps {
  filters: TransactionFilters
  onFilterChange: (filters: Partial<TransactionFilters>) => void
  onExport: () => void
  total: number
  categories: string[]
}

export default function TableFilters({ filters, onFilterChange, onExport, total, categories }: TableFiltersProps) {
  const [search, setSearch] = useState(filters.search || '')
  const [category, setCategory] = useState(filters.category || '')

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange({ search: value || undefined })
  }

  const handleCategoryChange = (value: string) => {
    setCategory(value)
    onFilterChange({ category: value || undefined })
  }

  return (
    <div className="table-filters">
      <div className="filters-row">
        <input
          type="text"
          placeholder="🔎 חיפוש בית עסק..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="filter-input"
        />
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="filter-select"
        >
          <option value="">הכל</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button onClick={onExport} className="btn btn-secondary">
          📥 ייצוא לאקסל
        </button>
      </div>
    </div>
  )
}
