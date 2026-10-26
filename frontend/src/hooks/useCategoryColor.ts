import { useContext } from 'react'
import { ThemeContext } from '../context/ThemeContext'
import { categoryColor } from '../utils/chartPalette'

// Theme-reactive categoryColor: subscribes to ThemeContext so custom
// (non-canonical) colors recompute immediately when the theme toggles,
// without a page reload. Canonical colors are CSS variables and adapt on
// their own; this hook matters for the computed custom hexes. Outside a
// ThemeProvider (unit tests) it falls back to the DOM data-theme attribute.
export function useCategoryColor(): (name: string) => string {
  const ctx = useContext(ThemeContext)
  const theme = ctx?.theme
  return (name: string) => categoryColor(name, theme)
}
