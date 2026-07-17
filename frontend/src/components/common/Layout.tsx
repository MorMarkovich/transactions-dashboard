import { type ReactNode, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './Header'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import QuickActions from './QuickActions'
import { useAuth } from '../../lib/AuthContext'
import { isValidRuleCategory } from '../../utils/constants'
import { supabaseApi } from '../../services/supabaseApi'
import { transactionsApi } from '../../services/api'
import './Layout.css'

// ─── Constants ────────────────────────────────────────────────────────
const MOBILE_BREAKPOINT = 1024
const COLLAPSED_KEY = 'sidebar-collapsed'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const hasTriedRestore = useRef(false)
  // Background-AI progress pill: null = hidden.
  const [aiStatus, setAiStatus] = useState<{ label: string; done?: boolean } | null>(null)
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Block rendering children until a stale session_id is verified/restored
  const [sessionValidating, setSessionValidating] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return !!params.get('session_id')
  })

  // Sidebar defaults: open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= MOBILE_BREAKPOINT
  })

  // Collapsed state persisted in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })

  // Track window resize to auto-show/hide sidebar
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const isDesktop = window.innerWidth >= MOBILE_BREAKPOINT
        setSidebarOpen(isDesktop)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Global Ctrl+K / Cmd+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-restore last session from Supabase when user logs in with no active session
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!user || hasTriedRestore.current) return
    hasTriedRestore.current = true

    const doRestore = () => {
      // Load saved transactions AND user-defined category rules in parallel,
      // then pass both to /restore-session so the rules are applied during
      // re-categorization.
      Promise.all([
        supabaseApi.getLatestTransactions(user.id),
        supabaseApi.getCategoryRules(user.id).catch(() => []),
        supabaseApi.getTransactionOverrides(user.id).catch(() => []),
      ])
        .then(([transactions, rules, overrides]) => {
          if (!transactions || transactions.length === 0) return
          // Rule hygiene: early AI runs persisted junk rules (category 'אחר'),
          // and rules override the whole categorizer. Purge them at the source
          // so they also stop reaching bank-sync, and restore with valid ones.
          const invalid = rules.filter((r) => !isValidRuleCategory(r.category))
          if (invalid.length) {
            supabaseApi
              .deleteCategoryRules(user.id, invalid.map((r) => r.merchant))
              .catch(() => {}) // best-effort; backend ignores them regardless
          }
          const validRules = rules.filter((r) => isValidRuleCategory(r.category))
          return transactionsApi.restoreSession(transactions, validRules, overrides)
        })
        .then(response => {
          if (response?.success && response.session_id) {
            // Preserve current page path when restoring session
            const currentPath = window.location.pathname
            navigate(`${currentPath}?session_id=${response.session_id}`, { replace: true })
            // The slow AI fallback (Claude + web search) runs in the
            // background — restore no longer waits for it, so the app paints
            // immediately. Resolved merchants are persisted as rules so each
            // is identified once, and open pages are told to refetch.
            runAiChain(response.session_id, user.id)
          }
        })
        .catch(() => {}) // Silent fail — user can upload a new file
        .finally(() => setSessionValidating(false))
    }

    if (!sessionId) {
      setSessionValidating(false)
      doRestore()
      return
    }

    // Session ID is in URL — verify it still exists in the backend.
    // After a backend restart all in-memory sessions are wiped, so a stale
    // session_id causes 404s across the whole app.
    setSessionValidating(true)
    transactionsApi.getMetrics(sessionId)
      .then(() => {
        // Session is valid — allow children to render
        setSessionValidating(false)
      })
      .catch(err => {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          doRestore()
        } else {
          setSessionValidating(false)
        }
      })
  }, [user, searchParams, navigate])

  // ── Fully automatic background AI chain ──────────────────────────────
  // categorize (שונות → web-verified categories) → subcategorize everything →
  // audit (second opinion, auto-applied only where the keyword catalog is
  // silent and confidence is high). A floating pill shows live progress from
  // GET /ai-progress so it's visible that cataloging is running / finished.
  const runAiChain = useCallback(async (sessionId: string, userId: string) => {
    const poll = async () => {
      try {
        const p = await transactionsApi.aiProgress(sessionId)
        if (p.stage === 'categorizing') {
          setAiStatus({ label: p.total ? `מסווג עסקים… ${p.done}/${p.total}` : 'מסווג עסקים…' })
        } else if (p.stage === 'subcategorizing') {
          setAiStatus({ label: `מפלח תתי-קטגוריות… ${p.done + 1}/${p.total}${p.detail ? ` · ${p.detail}` : ''}` })
        } else if (p.stage === 'auditing') {
          setAiStatus({ label: p.total ? `מאמת סיווגים מול האינטרנט… ${p.done}/${p.total}` : 'מאמת סיווגים מול האינטרנט…' })
        }
      } catch { /* progress is cosmetic */ }
    }
    setAiStatus({ label: 'מסווג עסקים…' })
    aiPollRef.current = setInterval(poll, 2000)
    try {
      // 1) categories for whatever is still שונות (unknowns web-verified)
      try {
        const ai = await transactionsApi.aiCategorize(sessionId)
        if (ai.ai_categorized?.length) {
          supabaseApi.upsertCategoryRules(userId, ai.ai_categorized).catch(() => {})
          window.dispatchEvent(new CustomEvent('ai-categorized'))
        }
      } catch { /* AI is an enhancement — never block the app on it */ }

      // 2) subcategories for every category, automatically
      try {
        const res = await transactionsApi.aiSubcategorizeAll(sessionId)
        const assignments = res.assignments ?? []
        for (const a of assignments) {
          await supabaseApi
            .upsertCategorySubrule(userId, a.merchant, a.category, a.subcategory)
            .catch(() => {})
        }
        if (assignments.length) window.dispatchEvent(new CustomEvent('ai-categorized'))
      } catch { /* ignore */ }

      // 3) exhaustive web verification: every merchant the keyword catalog
      // doesn't govern gets a mandatory web-searched verdict, batch after
      // batch until nothing remains. High-confidence corrections are applied;
      // confirmed merchants are pinned as rules so each one is verified ONCE,
      // ever — the sweep costs nothing on later loads.
      setAiStatus({ label: 'מאמת סיווגים מול האינטרנט…' })
      try {
        // Exclude ONLY merchants a previous sweep actually web-verified (a
        // persistent per-user ledger). Rules are NOT exclusions — most were
        // machine-created (old AI guesses, subcategory splits), i.e. exactly
        // the merchants that need verification.
        const LEDGER_KEY = `verified-merchants:${userId}`
        let ledger: string[] = []
        try { ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]') } catch { /* fresh */ }
        let exclude = [...ledger]
        for (let batch = 0; batch < 100; batch++) {
          const res = await transactionsApi.aiAudit(sessionId, exclude)
          const applicable = (res.proposals ?? []).filter((pr) => pr.confidence >= 0.85)
          for (const pr of applicable) {
            try {
              await transactionsApi.setMerchantCategory(sessionId, pr.merchant, pr.proposed_category)
              await supabaseApi
                .upsertCategoryRule(userId, pr.merchant, pr.proposed_category)
                .catch(() => {})
            } catch { /* per-merchant best effort */ }
          }
          // Pin web-confirmed merchants so they are never re-verified.
          const verified = res.verified ?? []
          if (verified.length) {
            await supabaseApi.upsertCategoryRules(userId, verified).catch(() => {})
          }
          if (applicable.length || verified.length) {
            window.dispatchEvent(new CustomEvent('ai-categorized'))
          }
          // Ledger: only merchants that actually got a web verdict (confirmed
          // or proposed). Verdict-less merchants (discarded/unsearched
          // batches) are retried on the next sweep.
          const gotVerdict = [
            ...verified.map((v) => v.merchant),
            ...(res.proposals ?? []).map((pr) => pr.merchant),
          ]
          if (gotVerdict.length) {
            ledger = Array.from(new Set([...ledger, ...gotVerdict]))
            try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)) } catch { /* full */ }
          }
          // Within this run, advance past everything already looked at.
          exclude = exclude.concat(res.audited_merchants || [])
          if (!res.audited_count || !res.remaining) break
        }
      } catch { /* ignore */ }
    } finally {
      if (aiPollRef.current) { clearInterval(aiPollRef.current); aiPollRef.current = null }
      setAiStatus({ label: 'הקיטלוג הסתיים ✓', done: true })
      setTimeout(() => setAiStatus(null), 6000)
    }
  }, [])

  // Clear the poller on unmount.
  useEffect(() => () => {
    if (aiPollRef.current) clearInterval(aiPollRef.current)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false)
    }
  }, [])

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  // File upload handler: navigate to dashboard with the new session_id
  const handleFileUploaded = useCallback(
    (sessionId: string) => {
      navigate(`/?session_id=${sessionId}`)
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setSidebarOpen(false)
      }
    },
    [navigate],
  )

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="layout-content">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={closeSidebar}
          onFileUploaded={handleFileUploaded}
          onToggleCollapse={toggleCollapse}
        />

        {/* Mobile overlay backdrop */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        {/* Main content area */}
        <main className="main-content">
          {sessionValidating ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', direction: 'rtl' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>...מאמת סשן</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <QuickActions />

      {/* Background-AI progress pill — visible while the automatic
          categorize → subcategorize → audit chain runs, then "done". */}
      <AnimatePresence>
        {aiStatus && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 9999,
              direction: 'rtl',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 'var(--radius-full, 999px)',
              border: '1px solid var(--glass-border, var(--border))',
              background: 'var(--glass-bg-hover, var(--glass-bg))',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'var(--elevation-2, 0 4px 12px rgba(0,0,0,0.25))',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {!aiStatus.done && (
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: '2px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            <span>{aiStatus.label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
