import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface DashboardFilters {
  category: string
  subcategory: string
}

interface FilterContextValue extends DashboardFilters {
  setCategory: (value: string) => void
  setSubcategory: (value: string) => void
  clearFilters: () => void
}

const STORAGE_KEY = 'transactions-dashboard:filters:v1'
const FilterContext = createContext<FilterContextValue | null>(null)

function readSaved(): DashboardFilters {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      category: typeof saved.category === 'string' ? saved.category : '',
      subcategory: typeof saved.subcategory === 'string' ? saved.subcategory : '',
    }
  } catch {
    return { category: '', subcategory: '' }
  }
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(readSaved)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  const setCategory = useCallback((category: string) => {
    setFilters((previous) => ({
      category,
      subcategory: category === previous.category ? previous.subcategory : '',
    }))
  }, [])
  const setSubcategory = useCallback((subcategory: string) => {
    setFilters((previous) => ({ ...previous, subcategory }))
  }, [])
  const clearFilters = useCallback(() => setFilters({ category: '', subcategory: '' }), [])

  const value = useMemo(() => ({ ...filters, setCategory, setSubcategory, clearFilters }), [filters, setCategory, setSubcategory, clearFilters])
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useDashboardFilters() {
  const context = useContext(FilterContext)
  if (!context) throw new Error('useDashboardFilters must be used inside FilterProvider')
  return context
}
