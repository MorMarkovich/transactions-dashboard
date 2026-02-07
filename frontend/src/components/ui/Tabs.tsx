import { type ReactNode, useRef, useCallback } from 'react'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  variant?: 'pill' | 'underline'
}

export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pill',
}: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let newIndex: number | null = null

      // RTL: ArrowRight goes to previous, ArrowLeft goes to next
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        newIndex = index === 0 ? tabs.length - 1 : index - 1
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        newIndex = index === tabs.length - 1 ? 0 : index + 1
      } else if (e.key === 'Home') {
        e.preventDefault()
        newIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        newIndex = tabs.length - 1
      }

      if (newIndex !== null) {
        tabRefs.current[newIndex]?.focus()
        onTabChange(tabs[newIndex].id)
      }
    },
    [tabs, onTabChange],
  )

  const isPill = variant === 'pill'

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={isPill ? 'ui-tabs-pill' : 'ui-tabs-underline'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isPill ? '4px' : '0',
        ...(isPill
          ? {
              background: 'var(--bg-secondary, #1e293b)',
              borderRadius: '12px',
              padding: '4px',
              border: '1px solid var(--border-color)',
            }
          : {
              borderBottom: '2px solid var(--border-color)',
              width: '100%',
            }),
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab

        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`ui-tab ${isActive ? 'ui-tab-active' : ''} ${isPill ? 'ui-tab-pill' : 'ui-tab-underline'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Heebo', sans-serif",
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              position: 'relative',

              ...(isPill
                ? {
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    background: isActive ? 'var(--gradient-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                  }
                : {
                    padding: '10px 20px',
                    background: 'transparent',
                    fontSize: '0.875rem',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: isActive
                      ? '2px solid var(--accent-primary)'
                      : '2px solid transparent',
                    marginBottom: '-2px',
                  }),
            }}
          >
            {tab.icon && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
          </button>
        )
      })}

      <style>{`
        .ui-tab-pill:not(.ui-tab-active):hover {
          background: var(--bg-elevated, #334155) !important;
          color: var(--text-primary) !important;
        }

        .ui-tab-underline:not(.ui-tab-active):hover {
          color: var(--text-secondary) !important;
          border-bottom-color: var(--border-color-hover) !important;
        }

        .ui-tab:focus-visible {
          outline: 2px solid var(--accent-primary);
          outline-offset: 2px;
          border-radius: 6px;
        }
      `}</style>
    </div>
  )
}
