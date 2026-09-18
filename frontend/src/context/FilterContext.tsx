import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface DashboardFilters {
  category: string
  subcategories: string[]
}

interface FilterContextValue extends DashboardFilters {
  setCategory: (value: string) => void
  setSubcategories: (value: string[]) => void
  clearFilters: () => void
}

const STORAGE_KEY = 'transactions-dashboard:filters:v1'
const FilterContext = createContext<FilterContextValue | null>(null)

function readSaved(): DashboardFilters {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      category: typeof saved.category === 'string' ? saved.category : '',
      subcategories: Array.isArray(saved.subcategories)
        ? saved.subcategories.filter((item: unknown): item is string => typeof item === 'string')
        : (typeof saved.subcategory === 'string' && saved.subcategory ? [saved.subcategory] : []),
    }
  } catch {
    return { category: '', subcategories: [] }
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
      subcategories: category === previous.category ? previous.subcategories : [],
    }))
  }, [])
  const setSubcategories = useCallback((subcategories: string[]) => {
    setFilters((previous) => ({ ...previous, subcategories: [...new Set(subcategories)] }))
  }, [])
  const clearFilters = useCallback(() => setFilters({ category: '', subcategories: [] }), [])

  const value = useMemo(() => ({ ...filters, setCategory, setSubcategories, clearFilters }), [filters, setCategory, setSubcategories, clearFilters])
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useDashboardFilters() {
  const context = useContext(FilterContext)
  if (!context) throw new Error('useDashboardFilters must be used inside FilterProvider')
  return context
}
