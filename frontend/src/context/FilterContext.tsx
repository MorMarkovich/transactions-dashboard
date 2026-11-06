import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../lib/AuthContext'
import { FILTERS_BASE, scoped } from '../lib/userStorage'

export interface DashboardFilters {
  category: string
  subcategories: string[]
}

interface FilterContextValue extends DashboardFilters {
  setCategory: (value: string) => void
  setSubcategories: (value: string[]) => void
  clearFilters: () => void
}

const EMPTY: DashboardFilters = { category: '', subcategories: [] }
const FilterContext = createContext<FilterContextValue | null>(null)

function readSaved(key: string): DashboardFilters {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      category: typeof saved.category === 'string' ? saved.category : '',
      subcategories: Array.isArray(saved.subcategories)
        ? saved.subcategories.filter((item: unknown): item is string => typeof item === 'string')
        : (typeof saved.subcategory === 'string' && saved.subcategory ? [saved.subcategory] : []),
    }
  } catch {
    return { ...EMPTY }
  }
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  // useContext (not useAuth) so the provider also renders outside an
  // AuthProvider — signed-out pages and standalone tests get in-memory
  // defaults that are never persisted.
  const auth = useContext(AuthContext)
  const userId = auth?.user?.id ?? null
  const storageKey = userId ? scoped(FILTERS_BASE, userId) : null

  // ownerKey tracks WHICH user's bucket the in-memory filters belong to, so a
  // mid-switch persist effect can never write one user's filters into
  // another's key.
  const [{ ownerKey, filters }, setState] = useState(() => ({
    ownerKey: storageKey,
    filters: storageKey ? readSaved(storageKey) : { ...EMPTY },
  }))

  // Adopt the newly signed-in user's saved filters (or defaults on sign-out).
  useEffect(() => {
    setState((prev) =>
      prev.ownerKey === storageKey
        ? prev
        : { ownerKey: storageKey, filters: storageKey ? readSaved(storageKey) : { ...EMPTY } },
    )
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || ownerKey !== storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters))
    } catch {
      // Storage unavailable — filters stay in memory for this session.
    }
  }, [storageKey, ownerKey, filters])

  const setCategory = useCallback((category: string) => {
    setState((prev) => ({
      ...prev,
      filters: {
        category,
        subcategories: category === prev.filters.category ? prev.filters.subcategories : [],
      },
    }))
  }, [])
  const setSubcategories = useCallback((subcategories: string[]) => {
    setState((prev) => ({ ...prev, filters: { ...prev.filters, subcategories: [...new Set(subcategories)] } }))
  }, [])
  const clearFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filters: { ...EMPTY } }))
  }, [])

  const value = useMemo(() => ({ ...filters, setCategory, setSubcategories, clearFilters }), [filters, setCategory, setSubcategories, clearFilters])
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useDashboardFilters() {
  const context = useContext(FilterContext)
  if (!context) throw new Error('useDashboardFilters must be used inside FilterProvider')
  return context
}
