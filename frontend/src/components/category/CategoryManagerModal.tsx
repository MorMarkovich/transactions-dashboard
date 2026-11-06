import { useState } from 'react'
import { Plus, Check, Edit2, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { get_icon, get_subcategory_icon } from '../../utils/constants'

export interface ManagerCategory {
  name: string
  subcategories: string[]
}

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  categories: ManagerCategory[]
  onRenameCategory: (oldName: string, newName: string) => Promise<void> | void
  onAddCategory: (name: string) => void
  onAddSubcategory: (parent: string, name: string) => void
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onRenameCategory,
  onAddCategory,
  onAddSubcategory,
}: CategoryManagerModalProps) {
  const [newCategory, setNewCategory] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [subDraft, setSubDraft] = useState<Record<string, string>>({})

  const [addReservedError, setAddReservedError] = useState(false)

  const addCategory = () => {
    const name = newCategory.trim()
    if (!name) return
    // 'אחר' is the chart-legend bucket — never a real category.
    if (name === 'אחר') { setAddReservedError(true); return }
    setAddReservedError(false)
    onAddCategory(name)
    setNewCategory('')
  }

  const [renameError, setRenameError] = useState<string | null>(null)

  const commitRename = async (oldName: string) => {
    const next = renameValue.trim()
    if (!next || next === oldName) { setRenaming(null); setRenameValue(''); return }
    try {
      setRenameError(null)
      await onRenameCategory(oldName, next)
      setRenaming(null)
      setRenameValue('')
    } catch {
      // Keep the editor open with the typed name so the user can retry.
      setRenameError('לא הצלחנו לשנות את השם. נסו שוב.')
    }
  }

  const addSub = (parent: string) => {
    const name = (subDraft[parent] ?? '').trim()
    if (!name) return
    onAddSubcategory(parent, name)
    setSubDraft((prev) => ({ ...prev, [parent]: '' }))
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: '1px solid var(--border-color, var(--border))',
    borderRadius: 'var(--radius-sm, 6px)',
    padding: '7px 10px',
    fontSize: '0.8125rem',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-family)',
    outline: 'none',
  }

  const primaryBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'var(--accent)',
    color: 'var(--on-accent, #fff)',
    padding: '0 12px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-family)',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ניהול קטגוריות" size="lg">
      <div style={{ direction: 'rtl' }}>
        {/* Add a new top-level category */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
            הוספת קטגוריה חדשה
          </label>
          <form
            onSubmit={(e) => { e.preventDefault(); addCategory() }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="שם הקטגוריה"
              style={inputStyle}
            />
            <button type="submit" disabled={!newCategory.trim()} style={{ ...primaryBtn, opacity: newCategory.trim() ? 1 : 0.5 }}>
              <Plus size={14} /> הוסף
            </button>
          </form>
          {addReservedError && (
            <p role="alert" style={{ fontSize: '0.7rem', color: 'var(--danger)', margin: '6px 2px 0' }}>
              ״אחר״ שמורה לסיכום בגרפים — בחרו שם אחר
            </p>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '6px 2px 0' }}>
            קטגוריות ותתי-קטגוריות חדשות יופיעו ברשימות הבחירה. הן נשמרות לצמיתות ברגע
            שמשייכים אליהן עסקה (דרך «שנה קטגוריה» בכרטיס קטגוריה).
          </p>
        </div>

        {/* Existing categories + their subcategories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflowY: 'auto' }}>
          {categories.map((cat) => (
            <div
              key={cat.name}
              style={{
                border: '1px solid var(--border-color, var(--border))',
                borderRadius: 'var(--radius-md, 10px)',
                padding: '10px 12px',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.05rem' }}>{get_icon(cat.name)}</span>
                {renaming === cat.name ? (
                  <form onSubmit={(e) => { e.preventDefault(); commitRename(cat.name) }} style={{ display: 'flex', gap: 6, flex: 1 }}>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                    <button type="submit" aria-label="שמור שם" style={{ ...primaryBtn, padding: '0 9px' }}>
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="בטל"
                      onClick={() => { setRenaming(null); setRenameValue(''); setRenameError(null) }}
                      style={{ border: '1px solid var(--border-color, var(--border))', borderRadius: 'var(--radius-sm,6px)', background: 'transparent', color: 'var(--text-muted)', padding: '0 9px', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                    {renameError && renaming === cat.name && (
                      <span role="alert" style={{ flexBasis: '100%', color: 'var(--danger)', fontSize: '0.6875rem' }}>
                        {renameError}
                      </span>
                    )}
                  </form>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 700, color: 'var(--text-primary)' }}>{cat.name}</span>
                    <button
                      onClick={() => { setRenaming(cat.name); setRenameValue(cat.name) }}
                      aria-label="שנה שם קטגוריה"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-color, var(--border))', borderRadius: 'var(--radius-full)', background: 'transparent', color: 'var(--text-secondary)', padding: '4px 9px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Edit2 size={11} /> שנה שם
                    </button>
                  </>
                )}
              </div>

              {/* Subcategories */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {cat.subcategories.length === 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>אין תתי-קטגוריות</span>
                )}
                {cat.subcategories.map((sub) => (
                  <span
                    key={sub}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', fontSize: '0.7rem', borderRadius: 'var(--radius-full)',
                      background: 'var(--glass-bg)', border: '1px solid var(--glass-border, var(--border))',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{get_subcategory_icon(sub)}</span>{sub}
                  </span>
                ))}
              </div>

              {/* Add subcategory */}
              <form
                onSubmit={(e) => { e.preventDefault(); addSub(cat.name) }}
                style={{ display: 'flex', gap: 6, marginTop: 8 }}
              >
                <input
                  value={subDraft[cat.name] ?? ''}
                  onChange={(e) => setSubDraft((prev) => ({ ...prev, [cat.name]: e.target.value }))}
                  placeholder="תת-קטגוריה חדשה"
                  style={{ ...inputStyle, fontSize: '0.75rem', padding: '6px 9px' }}
                />
                <button
                  type="submit"
                  disabled={!(subDraft[cat.name] ?? '').trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm,6px)', background: 'transparent', color: 'var(--accent)', padding: '0 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', opacity: (subDraft[cat.name] ?? '').trim() ? 1 : 0.5 }}
                >
                  <Plus size={12} /> תת-קטגוריה
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
