import { useEffect, useCallback, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUpDown, Calendar, Check, Edit2, Tag } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatting'
import { get_icon, CATEGORY_ICONS, get_subcategory_icon } from '../../utils/constants'
import type { Transaction } from '../../services/types'

interface CategoryTransactionsDrawerProps {
  isOpen: boolean
  onClose: () => void
  category: string
  month: string
  transactions: Transaction[]
  total: number
  loading?: boolean
  availableCategories?: string[]
  /**
   * Called when the user saves a new category for a transaction.
   * The parent is responsible for: (1) calling /api/transactions/category
   * to update the in-memory session, (2) persisting the merchant→category
   * rule to Supabase, and (3) refreshing dashboard data.
   * If undefined, the edit UI is hidden.
   */
  onCategoryChange?: (tx: Transaction, newCategory: string) => Promise<void>
  /** Subcategory names available for the current category (seeded ∪ in-use). */
  subcategoryOptions?: string[]
  /**
   * Called when the user saves a subcategory for a transaction. The parent
   * updates the in-memory session (/api/transactions/subcategory), persists the
   * merchant→{category, subcategory} rule, and refreshes. If undefined, the
   * subcategory edit UI is hidden.
   */
  onSubcategoryChange?: (tx: Transaction, newSubcategory: string) => Promise<void>
}

export default function CategoryTransactionsDrawer({
  isOpen,
  onClose,
  category,
  month,
  transactions,
  total,
  loading,
  availableCategories = [],
  onCategoryChange,
  subcategoryOptions = [],
  onSubcategoryChange,
}: CategoryTransactionsDrawerProps) {
  const [sortAsc, setSortAsc] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [customCategory, setCustomCategory] = useState('')
  const [customSubcategory, setCustomSubcategory] = useState('')

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Reset edit state when drawer closes or category changes.
  useEffect(() => {
    setEditingId(null)
    setSavingId(null)
    setCustomCategory('')
    setCustomSubcategory('')
  }, [isOpen, category])

  const categoryOptions = useMemo(() => {
    return Array.from(new Set([...availableCategories, ...Object.keys(CATEGORY_ICONS), category]))
      .filter((cat) => cat && cat.trim())
      .sort((a, b) => a.localeCompare(b, 'he'))
  }, [availableCategories, category])

  // Subcategories the user can pick: those seeded for this category plus any
  // already in use on the loaded transactions.
  const subOptions = useMemo(() => {
    const inUse = transactions
      .map((t) => (t.קטגוריה_משנה ?? '').trim())
      .filter(Boolean)
    return Array.from(new Set([...subcategoryOptions, ...inUse]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'he'))
  }, [subcategoryOptions, transactions])

  // Group transactions by subcategory (empty group last), each group sorted by
  // amount per the current sort direction.
  const groups = useMemo(() => {
    const bySub = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const sub = (tx.קטגוריה_משנה ?? '').trim()
      const arr = bySub.get(sub)
      if (arr) arr.push(tx)
      else bySub.set(sub, [tx])
    }
    const sortFn = (a: Transaction, b: Transaction) => {
      const d = Math.abs(a.סכום) - Math.abs(b.סכום)
      return sortAsc ? d : -d
    }
    const named = [...bySub.entries()]
      .filter(([sub]) => sub)
      .sort((a, b) => a[0].localeCompare(b[0], 'he'))
    const empty = bySub.get('') ? [['', bySub.get('')!] as [string, Transaction[]]] : []
    return [...named, ...empty].map(([sub, items]) => ({
      sub,
      items: [...items].sort(sortFn),
    }))
  }, [transactions, sortAsc])

  const hasSubGroups = groups.some((g) => g.sub)

  const handlePick = useCallback(
    async (tx: Transaction, newCategory: string) => {
      if (!onCategoryChange || tx.id == null) return
      const trimmed = newCategory.trim()
      if (!trimmed || trimmed === category) {
        setEditingId(null)
        return
      }
      setSavingId(tx.id)
      try {
        await onCategoryChange(tx, trimmed)
      } finally {
        setSavingId(null)
        setEditingId(null)
        setCustomCategory('')
      }
    },
    [onCategoryChange, category],
  )

  const handlePickSub = useCallback(
    async (tx: Transaction, newSub: string) => {
      if (!onSubcategoryChange || tx.id == null) return
      const trimmed = newSub.trim()
      const current = (tx.קטגוריה_משנה ?? '').trim()
      if (trimmed === current) return
      setSavingId(tx.id)
      try {
        await onSubcategoryChange(tx, trimmed)
      } finally {
        setSavingId(null)
        setEditingId(null)
        setCustomSubcategory('')
      }
    },
    [onSubcategoryChange],
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 99998,
            }}
          />

          {/* Drawer */}
          <motion.div
            className="category-transactions-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '480px',
              zIndex: 99999,
              background: 'var(--glass-bg-hover)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRight: '1px solid var(--glass-border)',
              boxShadow: 'var(--elevation-4)',
              direction: 'rtl',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.25rem' }}>{get_icon(category)}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {category}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {month || 'כל התקופה'} · {transactions.length === 1 ? 'עסקה אחת' : `${transactions.length} עסקאות`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="סגור"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Total hero */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>סך הוצאות</p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--danger)',
                    direction: 'ltr',
                  }}
                >
                  {formatCurrency(total)}
                </p>
              </div>
              <button
                onClick={() => setSortAsc((p) => !p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                }}
              >
                <ArrowUpDown size={12} />
                {sortAsc ? 'מהנמוך לגבוה' : 'מהגבוה לנמוך'}
              </button>
            </div>

            {/* Transaction list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
              }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  טוען...
                </div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  אין עסקאות
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groups.map((group) => (
                    <div key={group.sub || '__none__'} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {hasSubGroups && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          <span>{group.sub ? get_subcategory_icon(group.sub) : '•'}</span>
                          <span>{group.sub || 'ללא תת-קטגוריה'}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {group.items.length}</span>
                        </div>
                      )}
                      {group.items.map((tx, i) => {
                    const isEditing = editingId === tx.id
                    const isSaving = savingId === tx.id
                    const canEdit = !!onCategoryChange && tx.id != null
                    return (
                      <div
                        key={`${tx.תאריך}-${tx.תיאור}-${i}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '10px 14px',
                          background: 'var(--glass-bg)',
                          borderRadius: 'var(--radius-md, 8px)',
                          border: '1px solid var(--glass-border)',
                          gap: '8px',
                        }}
                      >
                        <div
                          className="category-transaction-main"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tx.תיאור}
                            </p>
                            {tx.הערות && (
                              <p
                                style={{
                                  margin: '2px 0 0',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tx.הערות}
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              <Calendar size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                {formatDate(tx.תאריך)}
                              </span>
                              {(tx.קטגוריה_משנה ?? '').trim() && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.625rem',
                                    padding: '1px 7px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  <span>{get_subcategory_icon((tx.קטגוריה_משנה ?? '').trim())}</span>
                                  {(tx.קטגוריה_משנה ?? '').trim()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="category-transaction-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--danger)',
                                direction: 'ltr',
                              }}
                            >
                              {formatCurrency(tx.סכום)}
                            </span>
                            {canEdit && (
                              <button
                                className="category-change-btn"
                                onClick={() => setEditingId(isEditing ? null : tx.id ?? null)}
                                aria-label={isEditing ? 'בטל עריכה' : 'ערוך קטגוריה'}
                                disabled={isSaving}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: 26,
                                  borderRadius: 'var(--radius-full)',
                                  border: '1px solid var(--glass-border)',
                                  background: isEditing ? 'var(--accent)' : 'var(--bg-elevated)',
                                  color: isEditing ? '#fff' : 'var(--accent)',
                                  cursor: isSaving ? 'wait' : 'pointer',
                                  flexShrink: 0,
                                  gap: '4px',
                                  padding: '0 9px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-family)',
                                }}
                              >
                                <Edit2 size={12} />
                                {isEditing ? 'בטל' : 'שנה קטגוריה'}
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing && canEdit && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              paddingTop: '8px',
                              borderTop: '1px solid var(--glass-border)',
                            }}
                          >
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                handlePick(tx, customCategory)
                              }}
                              style={{ display: 'flex', gap: '6px', width: '100%', marginBottom: '4px' }}
                            >
                              <input
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="שם קטגוריה"
                                disabled={isSaving}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  border: '1px solid var(--glass-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '6px 8px',
                                  fontSize: '0.75rem',
                                  background: 'var(--bg-primary)',
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-family)',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="submit"
                                disabled={isSaving || !customCategory.trim()}
                                style={{
                                  border: '1px solid var(--accent)',
                                  borderRadius: 'var(--radius-sm)',
                                  background: customCategory.trim() ? 'var(--accent)' : 'transparent',
                                  color: customCategory.trim() ? '#fff' : 'var(--text-muted)',
                                  padding: '0 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: isSaving || !customCategory.trim() ? 'not-allowed' : 'pointer',
                                  fontFamily: 'var(--font-family)',
                                }}
                              >
                                שמור
                              </button>
                            </form>
                            {categoryOptions.map((cat) => {
                              const selected = cat === category
                              return (
                                <button
                                  key={cat}
                                  onClick={() => handlePick(tx, cat)}
                                  disabled={isSaving}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '0.6875rem',
                                    borderRadius: 'var(--radius-full)',
                                    border: selected ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                    background: selected ? 'var(--accent-muted)' : 'var(--glass-bg)',
                                    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                                    cursor: isSaving ? 'wait' : 'pointer',
                                    fontFamily: 'var(--font-family)',
                                  }}
                                >
                                  <span>{get_icon(cat)}</span>
                                  <span>{cat}</span>
                                  {selected && <Check size={10} />}
                                </button>
                              )
                            })}
                            {onSubcategoryChange && (
                              <div style={{ width: '100%', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--glass-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                  <Tag size={11} /> תת-קטגוריה
                                </div>
                                <form
                                  onSubmit={(e) => { e.preventDefault(); handlePickSub(tx, customSubcategory) }}
                                  style={{ display: 'flex', gap: '6px', width: '100%', marginBottom: '6px' }}
                                >
                                  <input
                                    value={customSubcategory}
                                    onChange={(e) => setCustomSubcategory(e.target.value)}
                                    placeholder="שם תת-קטגוריה חדשה"
                                    disabled={isSaving}
                                    style={{
                                      flex: 1, minWidth: 0, border: '1px solid var(--glass-border)',
                                      borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '0.75rem',
                                      background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                      fontFamily: 'var(--font-family)', outline: 'none',
                                    }}
                                  />
                                  <button
                                    type="submit"
                                    disabled={isSaving || !customSubcategory.trim()}
                                    style={{
                                      border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
                                      background: customSubcategory.trim() ? 'var(--accent)' : 'transparent',
                                      color: customSubcategory.trim() ? '#fff' : 'var(--text-muted)',
                                      padding: '0 10px', fontSize: '0.75rem', fontWeight: 700,
                                      cursor: isSaving || !customSubcategory.trim() ? 'not-allowed' : 'pointer',
                                      fontFamily: 'var(--font-family)',
                                    }}
                                  >
                                    שמור
                                  </button>
                                </form>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {(tx.קטגוריה_משנה ?? '').trim() && (
                                    <button
                                      onClick={() => handlePickSub(tx, '')}
                                      disabled={isSaving}
                                      style={{
                                        padding: '4px 8px', fontSize: '0.6875rem', borderRadius: 'var(--radius-full)',
                                        border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                                        color: 'var(--text-muted)', cursor: isSaving ? 'wait' : 'pointer',
                                        fontFamily: 'var(--font-family)',
                                      }}
                                    >
                                      נקה תת-קטגוריה
                                    </button>
                                  )}
                                  {subOptions.map((sub) => {
                                    const selected = sub === (tx.קטגוריה_משנה ?? '').trim()
                                    return (
                                      <button
                                        key={sub}
                                        onClick={() => handlePickSub(tx, sub)}
                                        disabled={isSaving}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                                          padding: '4px 8px', fontSize: '0.6875rem', borderRadius: 'var(--radius-full)',
                                          border: selected ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                          background: selected ? 'var(--accent-muted)' : 'var(--glass-bg)',
                                          color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                                          cursor: isSaving ? 'wait' : 'pointer', fontFamily: 'var(--font-family)',
                                        }}
                                      >
                                        <span>{get_subcategory_icon(sub)}</span>
                                        <span>{sub}</span>
                                        {selected && <Check size={10} />}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
