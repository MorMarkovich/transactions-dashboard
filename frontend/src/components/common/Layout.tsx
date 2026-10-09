import { type ReactNode, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useDashboardFilters } from '../../context/FilterContext'
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './Header'
import { useModalFocus } from '../../hooks/useModalFocus'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { LayoutDashboard, Receipt, CalendarRange, Menu } from 'lucide-react'
import Skeleton from '../ui/Skeleton'
import { useAuth } from '../../lib/AuthContext'
import { isValidRuleCategory, migrateRule } from '../../utils/constants'
import { supabaseApi } from '../../services/supabaseApi'
import { transactionsApi } from '../../services/api'
import './Layout.css'

// ─── Constants ────────────────────────────────────────────────────────
const AUTO_AI_ENABLED = import.meta.env.VITE_AUTO_AI !== 'false'

interface LayoutProps {
  children: ReactNode
}

// Remember how far each page was scrolled so tapping back to it (tab bar,
// back button) returns to the same place instead of the top.
const scrollPositions = new Map<string, number>()

const HASH_RE = /\/assets\/index-([A-Za-z0-9_-]+)\.js/

/** Build id of the code this tab is running (hash of the entry bundle). */
function runningBuild(): string {
  const el = document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null
  const m = el?.getAttribute('src')?.match(HASH_RE)
  return m?.[1] ?? ''
}

async function deployedBuild(): Promise<string> {
  const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
  if (!res.ok) return ''
  return (await res.text()).match(HASH_RE)?.[1] ?? ''
}

const CHECK_EVERY_MS = 10 * 60 * 1000

/** True when the deployed build differs from the one this (possibly long-open) tab runs. */
function useNewVersionAvailable(): boolean {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const mine = runningBuild()
    if (!mine) return
    let alive = true
    let last = 0
    const check = async () => {
      if (document.visibilityState === 'hidden' || Date.now() - last < 30_000) return
      last = Date.now()
      try {
        const live = await deployedBuild()
        if (alive && live && live !== mine) setStale(true)
      } catch { /* offline: try again later */ }
    }
    const timer = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])
  return stale
}

const LAST_SESSION_KEY = 'transactions-dashboard:last-session'
// created_at of the Supabase snapshot this device's session was built from. When
// another device (or a bank refresh) saves a newer snapshot, this device rebuilds
// instead of showing older numbers.
const SNAPSHOT_SEEN_KEY = 'transactions-dashboard:snapshot-seen'
const isNewer = (a: string | null, b: string | null) => {
  if (!a) return false
  if (!b) return true
  return new Date(a).getTime() > new Date(b).getTime()
}
const formatStamp = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
}

function useScrollMemory(pathname: string) {
  // Own scroll restoration, including back/forward (the browser's automatic restore fires
  // before the page content exists and lands on 0).
  useEffect(() => {
    const prev = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = prev }
  }, [])
  const currentPath = useRef(pathname)
  // While a page is swapping/restoring, the browser clamps scroll to the (short, still
  // loading) new document and fires scroll events. Those must never overwrite the
  // remembered position of either page.
  const suspended = useRef(false)
  useLayoutEffect(() => {
    suspended.current = true
    currentPath.current = pathname
  }, [pathname])
  useEffect(() => {
    let lastHeight = document.documentElement.scrollHeight
    const record = () => {
      const height = document.documentElement.scrollHeight
      const shrank = height < lastHeight - 40
      const atBottom = window.scrollY >= height - window.innerHeight - 2
      lastHeight = height
      // A page that got shorter (list reloading) clamps scroll; that is not the user's position.
      if (suspended.current || (shrank && atBottom)) return
      scrollPositions.set(currentPath.current, window.scrollY)
    }
    // Scroll events can be delayed or dropped (hidden tab, busy frame), so also snapshot the
    // position right before any navigation starts, while the old page is still on screen.
    window.addEventListener('scroll', record, { passive: true })
    document.addEventListener('click', record, true)
    window.addEventListener('popstate', record)
    return () => {
      window.removeEventListener('scroll', record)
      document.removeEventListener('click', record, true)
      window.removeEventListener('popstate', record)
    }
  }, [])
  useEffect(() => {
    const y = scrollPositions.get(pathname) ?? 0
    let tries = 0
    let release = 0
    let lastSet: number | null = null
    let lastHeightSeen = document.documentElement.scrollHeight
    const finish = () => {
      window.clearInterval(id)
      release = window.setTimeout(() => { suspended.current = false }, 200)
    }
    // Wait for a short page to grow (data still loading) before giving up: up to ~10s.
    // If something else moved the scroll (the user), stop instead of fighting it.
    const id = window.setInterval(() => {
      tries += 1
      const height = document.documentElement.scrollHeight
      // A scroll change while the page height changed is a clamp, not the user.
      if (lastSet !== null && height === lastHeightSeen && Math.abs(window.scrollY - lastSet) > 4) { finish(); return }
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
      lastSet = window.scrollY
      lastHeightSeen = document.documentElement.scrollHeight
      if (Math.abs(window.scrollY - y) < 4 || tries > 125) finish()
    }, 80)
    return () => { window.clearInterval(id); window.clearTimeout(release) }
  }, [pathname])
}

// Give every chart an accessible name (recharts renders unlabeled SVGs)
function useChartLabels(pathname: string) {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLElement>('.recharts-wrapper:not([data-a11y])').forEach((el) => {
        let name = 'תרשים'
        const explicit = el.closest<HTMLElement>('[data-chart-label]')?.dataset.chartLabel
        if (explicit) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', `תרשים: ${explicit}`); el.setAttribute('data-a11y', '1'); return }
        let node: HTMLElement | null = el
        for (let i = 0; i < 6 && node; i += 1) {
          const header = node.parentElement?.querySelector<HTMLElement>('.section-header-v2, h2, h3')
          if (header?.innerText?.trim()) { name = `תרשים: ${header.innerText.trim().split('\n')[0]}`; break }
          node = node.parentElement
        }
        el.setAttribute('role', 'img')
        el.setAttribute('aria-label', name)
        el.setAttribute('data-a11y', '1')
      })
    }
    label()
    // Charts mount whenever their data arrives (can be many seconds on a cold session): keep labeling.
    let pending = 0
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending)
      pending = window.setTimeout(label, 150)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); window.clearTimeout(pending) }
  }, [pathname])
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  useScrollMemory(location.pathname)
  useChartLabels(location.pathname)
  const { category: activeCategory, subcategories: activeSubs, clearFilters } = useDashboardFilters()
  const { user } = useAuth()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const hasTriedRestore = useRef(false)
  // Background-AI progress pill: null = hidden.
  const [aiStatus, setAiStatus] = useState<{ label: string; done?: boolean } | null>(null)
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Block rendering children until a stale session_id is verified/restored
  const [sessionValidating, setSessionValidating] = useState(() => {
    return true
  })
  const [restoreFailed, setRestoreFailed] = useState(false)
  const newVersion = useNewVersionAvailable()
  const [snapshotAt, setSnapshotAt] = useState<string | null>(() => localStorage.getItem(SNAPSHOT_SEEN_KEY))

  // The Orbit shell uses a horizontal desktop nav; the drawer is explicit on every screen.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useModalFocus(sidebarOpen)
  const openSearch = () => { setSidebarOpen(false); setCommandPaletteOpen(true) }

  // Global Ctrl+K / Cmd+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSidebarOpen(false)
        setCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-restore last session from Supabase when user logs in with no active session
  useEffect(() => {
    const urlSession = searchParams.get('session_id')
    if (urlSession && !urlSession.includes('::')) localStorage.setItem(LAST_SESSION_KEY, urlSession)
    if (!user || hasTriedRestore.current) return
    hasTriedRestore.current = true
    // A link without ?session_id (bookmark, address bar) reuses the last
    // session rather than rebuilding one from the database every time.
    const rememberedSession = urlSession ? null : localStorage.getItem(LAST_SESSION_KEY)
    const sessionId = urlSession || rememberedSession

    const doRestore = (attempt = 0) => {
      const snapshotAtPromise = supabaseApi.getLatestSnapshotAt(user.id).catch(() => null)
      // Load saved transactions AND user-defined category rules in parallel,
      // then pass both to /restore-session so the rules are applied during
      // re-categorization.
      Promise.all([
        supabaseApi.getLatestTransactions(user.id),
        supabaseApi.getCategoryRules(user.id).catch(() => []),
        supabaseApi.getTransactionOverrides(user.id).catch(() => []),
        supabaseApi.getUserCategories(user.id).catch(() => []),
        supabaseApi.getTransactionNotes(user.id).catch(() => []),
      ])
        .then(([transactions, rules, overrides, customCats, notes]) => {
          if (!transactions || transactions.length === 0) return
          // Taxonomy migration: rules saved under the OLD category tree are
          // rewritten to the new one — in memory for this restore, and
          // best-effort in Supabase so bank-sync sees new names too.
          const rewrites = rules
            .map((r) => migrateRule(r))
            .filter((r): r is NonNullable<typeof r> => !!r)
          if (rewrites.length) {
            Promise.allSettled(
              rewrites.map((r) =>
                supabaseApi.upsertCategorySubrule(user.id, r.merchant, r.category, r.subcategory || ''),
              ),
            ).catch(() => {})
          }
          const effectiveRules = rules.map((r) => migrateRule(r) ?? r)
          const customNames = customCats.map((c) => c.name)
          // Rule hygiene: early AI runs persisted junk rules (category 'אחר'),
          // and rules override the whole categorizer. Purge them at the source
          // so they also stop reaching bank-sync, and restore with valid ones.
          const invalid = effectiveRules.filter((r) => !isValidRuleCategory(r.category, customNames))
          if (invalid.length) {
            supabaseApi
              .deleteCategoryRules(user.id, invalid.map((r) => r.merchant))
              .catch(() => {}) // best-effort; backend ignores them regardless
          }
          const validRules = effectiveRules.filter((r) => isValidRuleCategory(r.category, customNames))
          return transactionsApi.restoreSession(transactions, validRules, overrides, customNames, notes)
        })
        .then(response => {
          if (response?.success && response.session_id) {
            snapshotAtPromise.then((at) => {
              if (at) { localStorage.setItem(SNAPSHOT_SEEN_KEY, at); setSnapshotAt(at) }
            })
            // Preserve current page path when restoring session
            const currentPath = window.location.pathname
            navigate(`${currentPath}?session_id=${response.session_id}`, { replace: true })
            // The slow AI fallback (Claude + web search) runs in the
            // background — restore no longer waits for it, so the app paints
            // immediately. Resolved merchants are persisted as rules so each
            // is identified once, and open pages are told to refetch.
            if (AUTO_AI_ENABLED) runAiChain(response.session_id, user.id)
          }
        })
        .catch(async (err: unknown) => {
          // Rate-limited restore: wait out Retry-After once instead of
          // leaving the user on an empty account screen.
          const res = (err as { response?: { status?: number; headers?: Record<string, string> } })?.response
          if (res?.status === 429 && attempt < 1) {
            const wait = Math.min(20, Math.max(2, Number(res.headers?.['retry-after']) || 5))
            await new Promise((r) => setTimeout(r, wait * 1000))
            doRestore(attempt + 1)
            return
          }
          setRestoreFailed(true)
        })
        .finally(() => setSessionValidating(false))
    }

    if (!sessionId) {
      setSessionValidating(true)
      doRestore()
      return
    }

    // Session ID is in URL — verify it still exists in the backend.
    // After a backend restart all in-memory sessions are wiped, so a stale
    // session_id causes 404s across the whole app.
    setSessionValidating(true)
    transactionsApi.getMetrics(sessionId)
      .then(async () => {
        // Session is valid, but another device (or a bank refresh) may have saved
        // newer data since this one was built.
        const latest = await supabaseApi.getLatestSnapshotAt(user.id).catch(() => null)
        if (isNewer(latest, localStorage.getItem(SNAPSHOT_SEEN_KEY))) {
          doRestore()
          return
        }
        setSnapshotAt(localStorage.getItem(SNAPSHOT_SEEN_KEY))
        if (rememberedSession) {
          navigate(`${window.location.pathname}?session_id=${rememberedSession}`, { replace: true })
        }
        setSessionValidating(false)
      })
      .catch(err => {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          doRestore()
        } else {
          setSessionValidating(false)
        }
      })
  // runAiChain is intentionally stable (empty useCallback dependency list)
  // and is declared below this restore effect for readability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSidebarOpen(false)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [sidebarOpen])

  // File upload handler: navigate to dashboard with the new session_id
  const handleFileUploaded = useCallback(
    (sessionId: string) => {
      navigate(`/?session_id=${sessionId}`)
      if (sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    [navigate, sidebarOpen],
  )

  return (
    <div className="layout orbit-layout">
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        onCommandPalette={openSearch}
      />

      <div className="layout-content">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={false}
          onClose={closeSidebar}
          onFileUploaded={handleFileUploaded}
          onSearch={openSearch}
        />

        {/* Mobile overlay backdrop */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        {/* Main content area */}
        <main className="main-content">
          {newVersion && (
            <div className="update-bar" role="status">
              <span>גרסה חדשה זמינה</span>
              <button type="button" className="ui-btn" onClick={() => window.location.reload()}>רענון</button>
            </div>
          )}
          {!sessionValidating && activeCategory && (
            <div className="active-filter-banner" role="status">
              <span>
                מסונן לפי קטגוריה: <strong>{activeCategory}</strong>
                {activeSubs.length > 0 ? ` (${activeSubs.length} תתי-קטגוריות)` : ''}
              </span>
              <button type="button" className="ui-btn" onClick={clearFilters}>נקה סינון</button>
            </div>
          )}
          {!sessionValidating && snapshotAt && formatStamp(snapshotAt) && (
            <div className="data-freshness" data-testid="data-freshness">הנתונים עודכנו: {formatStamp(snapshotAt)}{runningBuild() ? ` · גרסה ${runningBuild().slice(0, 8)}` : ''}</div>
          )}
          {sessionValidating ? (
            <div className="studio-loading" role="status" aria-label="טוען את הנתונים שלך">
              <Skeleton variant="rectangular" height={52}/><div className="studio-loading-grid"><Skeleton variant="rectangular" height={260}/><Skeleton variant="rectangular" height={260}/></div><Skeleton variant="rectangular" height={320}/>
            </div>
          ) : restoreFailed ? (
            <div className="studio-loading" role="alert" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <p style={{ marginBottom: 12 }}>לא הצלחנו לטעון את הנתונים כרגע. הנתונים שלך שמורים.</p>
              <button className="ui-btn" onClick={() => window.location.reload()}>נסה שוב</button>
            </div>
          ) : (
            // No exit animation: an exit that never completes (rapid route changes, aborted fetches)
            // used to leave the page wrapper stuck at opacity 0.
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }}
            >
              {children}
            </motion.div>
          )}
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <nav className="mobile-bottom-nav" aria-label="ניווט מהיר">
        {[{to:'/',text:'סקירה',Icon:LayoutDashboard},{to:'/transactions',text:'עסקאות',Icon:Receipt},{to:'/monthly',text:'השוואת חודשים',Icon:CalendarRange}].map(({to,text,Icon}) => <NavLink key={to} to={`${to}${searchParams.get('session_id') ? `?session_id=${searchParams.get('session_id')}` : ''}`} end={to === '/'}><Icon size={20}/><span>{text}</span></NavLink>)}
        <button onClick={toggleSidebar}><Menu size={20}/><span>תפריט</span></button>
      </nav>

      {/* Background-AI progress pill — visible while the automatic
          categorize → subcategorize → audit chain runs, then "done". */}
      <AnimatePresence>
        {aiStatus && (
          <motion.div
            className="ai-status-pill"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              position: 'fixed',
              bottom: 88,
              left: 16,
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
