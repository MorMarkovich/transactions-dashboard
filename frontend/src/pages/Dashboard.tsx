import { defaultMonth } from '../utils/defaultMonth'
import { groupMonthCategories, type MonthLegendItem } from '../utils/monthLegend'
import { categoryColor } from '../utils/chartPalette'
import MonthlyPulse from '../components/dashboard/MonthlyPulse'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAppNotifications } from '../context/NotificationContext'
import { motion } from 'framer-motion'
import {
  Calendar,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Zap,
  LayoutDashboard,
  CreditCard,
  ChevronLeft,
  ArrowUpDown,
  Grid3X3,
  Tag,
  Search,
  X,
  SlidersHorizontal,
  Edit2,
  Check,
} from 'lucide-react'
import { filterAndSortCategories, countActiveFilters } from '../utils/categoryFilters'
import { ASSIGNABLE_CATEGORIES, get_icon } from '../utils/constants'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SparklineChart from '../components/charts/SparklineChart'
import DonutChart from '../components/charts/DonutChart'
import CategoryManagerModal, { type ManagerCategory } from '../components/category/CategoryManagerModal'
import CategoryTransactionsDrawer from '../components/table/CategoryTransactionsDrawer'
import EmptyState from '../components/common/EmptyState'
import RefreshFromBanks from '../components/common/RefreshFromBanks'
import PageHeader from '../components/common/PageHeader'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import MultiSelect from '../components/ui/MultiSelect'
import { formatCurrency } from '../utils/formatting'
import { transactionsApi } from '../services/api'
import { supabaseApi } from '../services/supabaseApi'
import { useAuth } from '../lib/AuthContext'
import { useDashboardFilters } from '../context/FilterContext'
import type {
  MetricsData,
  RawDonutData,
  IncomeSourcesData,
  RawMonthlyData,
  RawWeekdayData,
  WeeklySummaryData,
  ForecastData,
  SpendingVelocityData,
  AnomalyItem,
  MonthOverviewData,
  CategorySnapshotData,
  CategoryCatalog,
  Transaction,
} from '../services/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format MM/YYYY → Hebrew-friendly label, e.g. "01/2024" → "ינואר 2024" */
const HEBREW_MONTHS: Record<string, string> = {
  '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
  '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
  '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר',
}
function formatMonthLabel(mmYYYY: string): string {
  const [mm, yyyy] = mmYYYY.split('/')
  return `${HEBREW_MONTHS[mm] ?? mm} ${yyyy}`
}

// Legend colors for the income-sources list — same order as DonutChart's
// palette so the dots match the pie slices.
const INCOME_COLORS = [
  '#818cf8', '#34d399', '#f87171', '#fbbf24', '#38bdf8',
  '#a78bfa', '#f6ad55', '#68d391', '#fc8181', '#63b3ed', '#94a3b8',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')
  const { category, subcategories, setCategory, setSubcategories, clearFilters } = useDashboardFilters()
  const { setNotifications } = useAppNotifications()
  const { user } = useAuth()

  // ── Data state ────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [, setDonutData] = useState<RawDonutData | null>(null)
  const [incomeSources, setIncomeSources] = useState<IncomeSourcesData | null>(null)
  const [monthlyData, setMonthlyData] = useState<RawMonthlyData | null>(null)
  const [, setWeekdayData] = useState<RawWeekdayData | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [velocity, setVelocity] = useState<SpendingVelocityData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [monthOverview, setMonthOverview] = useState<MonthOverviewData | null>(null)
  const [categorySnapshot, setCategorySnapshot] = useState<CategorySnapshotData | null>(null)
  const [categoryCatalog, setCategoryCatalog] = useState<CategoryCatalog | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  // User-created category / subcategory names (persisted in localStorage so they
  // appear in the picker lists even before a transaction is assigned to them;
  // an actual assignment is what persists them server-side as a rule).
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>({})

  const addCustomCategory = useCallback((name: string) => {
    const n = name.trim()
    if (!n) return
    setCustomCategories((prev) => {
      if (prev.includes(n)) return prev
      const next = [...prev, n]
      if (user) { try { localStorage.setItem(`customCats:${user.id}`, JSON.stringify(next)) } catch { /* ignore */ } }
      return next
    })
  }, [user])

  const addCustomSubcategory = useCallback((parent: string, name: string) => {
    const n = name.trim()
    if (!n || !parent) return
    setCustomSubcategories((prev) => {
      const existing = prev[parent] ?? []
      if (existing.includes(n)) return prev
      const next = { ...prev, [parent]: [...existing, n] }
      if (user) { try { localStorage.setItem(`customSubs:${user.id}`, JSON.stringify(next)) } catch { /* ignore */ } }
      return next
    })
  }, [user])

  // ── UI state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // View state (selected month / date-type / person) survives data refreshes,
  // page switches and session rebuilds — an edit must never bounce the user
  // from the month they were looking at back to the latest one.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    () => sessionStorage.getItem('dash-month'),
  )
  const [dateType, setDateType] = useState<'transaction' | 'billing'>(
    () => (sessionStorage.getItem('dash-date-type') === 'transaction' ? 'transaction' : 'billing'),
  )
  // Per-person filter: list of owners in the data + the currently selected one
  // (null = everyone). The selection re-scopes every chart/metric below.
  const [owners, setOwners] = useState<string[]>([])
  const [selectedOwner, setSelectedOwner] = useState<string | null>(
    () => sessionStorage.getItem('dash-owner'),
  )

  // Persist the view state for the rest of the browser session.
  useEffect(() => {
    if (selectedMonth) sessionStorage.setItem('dash-month', selectedMonth)
  }, [selectedMonth])
  useEffect(() => {
    sessionStorage.setItem('dash-date-type', dateType)
  }, [dateType])
  useEffect(() => {
    if (selectedOwner) sessionStorage.setItem('dash-owner', selectedOwner)
    else sessionStorage.removeItem('dash-owner')
  }, [selectedOwner])
  const [monthOverviewLoading, setMonthOverviewLoading] = useState(false)
  // Bumping this forces every data-fetch effect to re-run; used after a
  // manual category override so all widgets reflect the new classification.
  const [refreshKey, setRefreshKey] = useState(0)

  // The AI fallback runs in the background after restore (see Layout);
  // when it resolves merchants, refetch so the widgets pick up the new
  // categories without a manual reload.
  useEffect(() => {
    const onAiCategorized = () => setRefreshKey((k) => k + 1)
    window.addEventListener('ai-categorized', onAiCategorized)
    return () => window.removeEventListener('ai-categorized', onAiCategorized)
  }, [])
  const [snapshotSort, setSnapshotSort] = useState<'amount' | 'change' | 'count' | 'avg'>('amount')
  const [snapshotExpanded, setSnapshotExpanded] = useState(false)
  const [chipsOpen, setChipsOpen] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const fn = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  const [snapshotSearch, setSnapshotSearch] = useState('')
  const [snapshotExcluded, setSnapshotExcluded] = useState<Set<string>>(new Set())
  const [snapshotMinAmount, setSnapshotMinAmount] = useState('')
  const [snapshotMaxAmount, setSnapshotMaxAmount] = useState('')
  const [snapshotMonthFrom, setSnapshotMonthFrom] = useState('')
  const [snapshotMonthTo, setSnapshotMonthTo] = useState('')
  const [snapshotSelectedCats, setSnapshotSelectedCats] = useState<Set<string> | null>(null)
  const [snapshotShowAdvanced, setSnapshotShowAdvanced] = useState(false)
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null)
  const [categoryRenameValue, setCategoryRenameValue] = useState('')
  const [savingCategoryName, setSavingCategoryName] = useState<string | null>(null)

  // ── Category drill-down drawer state ────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerCategory, setDrawerCategory] = useState('')
  const [drawerTransactions, setDrawerTransactions] = useState<Transaction[]>([])
  const [drawerTotal, setDrawerTotal] = useState(0)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState(false)
  const drawerReqRef = useRef(0)

  // Load (or reload) the drawer's transaction list for a category, using the
  // snapshot date-range filters so it matches what the card displays.
  const loadDrawerTransactions = useCallback(async (categoryName: string, keepList = false) => {
    if (!sessionId) return
    const reqId = ++drawerReqRef.current
    setDrawerLoading(true)
    setDrawerError(false)
    if (!keepList) { setDrawerTransactions([]); setDrawerTotal(0) }
    const attempt = async () => {
      const sid = await transactionsApi.scopeSession(sessionId, selectedOwner, undefined, category, subcategories)
      return transactionsApi.getCategoryTransactions(
        sid, '', categoryName, dateType, undefined, undefined,
        snapshotMonthFrom || undefined, snapshotMonthTo || undefined,
      )
    }
    try {
      let data
      try { data = await attempt() } catch { await new Promise((r) => setTimeout(r, 900)); data = await attempt() }
      if (reqId !== drawerReqRef.current) return
      setDrawerTransactions(data.transactions)
      setDrawerTotal(data.total)
    } catch {
      if (reqId !== drawerReqRef.current) return
      setDrawerError(true)
    } finally {
      if (reqId === drawerReqRef.current) setDrawerLoading(false)
    }
  }, [sessionId, snapshotMonthFrom, snapshotMonthTo, dateType, selectedOwner, category, subcategories])

  const handleCategoryCardClick = useCallback(async (categoryName: string) => {
    if (!sessionId) return
    setDrawerCategory(categoryName)
    setDrawerOpen(true)
    await loadDrawerTransactions(categoryName)
  }, [sessionId, loadDrawerTransactions])

  // ── Manual category override ──
  // Persists the new category in two places: (1) the in-memory backend
  // session, so the current dashboard view updates immediately; (2) a
  // merchant→category rule in Supabase, so every future upload with the
  // same merchant string gets the corrected category automatically.
  const handleCategoryChange = useCallback(
    async (tx: Transaction, newCategory: string, onlyThis: boolean = false) => {
      if (!sessionId || tx.id == null) return
      try {
        const resp = await transactionsApi.updateTransactionCategory(sessionId, tx.id, newCategory, onlyThis)
        // A name outside the built-in tree is a user-created category — the
        // dynamic taxonomy. Persist it so it stays valid on every restore,
        // and remember it locally so pickers offer it immediately.
        if (!ASSIGNABLE_CATEGORIES.includes(newCategory)) {
          addCustomCategory(newCategory)
          if (user) supabaseApi.upsertUserCategory(user.id, newCategory).catch(() => {})
        }
        if (user && onlyThis && resp.txn_key) {
          // "אל תשנה עסקאות דומות": pin ONLY this transaction — no merchant
          // rule, so similar transactions (e.g. other ביט transfers) keep
          // their own categories, now and on every future restore.
          await supabaseApi
            .upsertTransactionOverride(user.id, resp.txn_key, newCategory, null)
            .catch((e) => {
              console.warn('Failed to persist transaction override:', e)
            })
        } else if (user && !onlyThis) {
          if (resp.merchant) {
            await supabaseApi.upsertCategoryRule(user.id, resp.merchant, newCategory).catch((e) => {
              console.warn('Failed to persist category rule (will retry on next edit):', e)
            })
          }
          // A normal edit explicitly unpins the row (back to merchant-rule mode).
          if (resp.txn_key) {
            supabaseApi.deleteTransactionOverride(user.id, resp.txn_key).catch(() => {})
          }
        }
      } finally {
        // Refresh every widget, but KEEP the drawer open on the same list —
        // an edit must not bounce the user back to the dashboard.
        setRefreshKey((k) => k + 1)
        if (drawerOpen && drawerCategory) loadDrawerTransactions(drawerCategory, true)
      }
    },
    [sessionId, user, drawerOpen, drawerCategory, loadDrawerTransactions, addCustomCategory],
  )

  // ── Manual subcategory override ──
  // Mirrors handleCategoryChange: updates the in-memory session, then persists a
  // merchant→{category, subcategory} rule (we send the category the backend
  // reports so the NOT-NULL `category` column is satisfied), then refreshes.
  const handleSubcategoryChange = useCallback(
    async (tx: Transaction, newSubcategory: string, onlyThis: boolean = false) => {
      if (!sessionId || tx.id == null) return
      try {
        const resp = await transactionsApi.updateTransactionSubcategory(sessionId, tx.id, newSubcategory, onlyThis)
        // Remember a newly typed subcategory name under its parent so it's
        // offered in every future picker (localStorage + the session-usage
        // merge on /categories/catalog keep it available everywhere).
        if (newSubcategory && resp.category) {
          addCustomSubcategory(resp.category, newSubcategory)
        }
        if (user && onlyThis && resp.txn_key && resp.category) {
          // Pin this transaction's {category, subcategory} without creating a
          // merchant-wide rule.
          await supabaseApi
            .upsertTransactionOverride(user.id, resp.txn_key, resp.category, newSubcategory || null)
            .catch((e) => {
              console.warn('Failed to persist transaction override:', e)
            })
        } else if (user && !onlyThis && resp.merchant && resp.category) {
          await supabaseApi
            .upsertCategorySubrule(user.id, resp.merchant, resp.category, newSubcategory)
            .catch((e) => {
              console.warn('Failed to persist subcategory rule (will retry on next edit):', e)
            })
        }
      } finally {
        // Same as handleCategoryChange: refresh in place, don't close.
        setRefreshKey((k) => k + 1)
        if (drawerOpen && drawerCategory) loadDrawerTransactions(drawerCategory, true)
      }
    },
    [sessionId, user, drawerOpen, drawerCategory, loadDrawerTransactions, addCustomSubcategory],
  )

  // ── Bulk category move ──
  // Several selected transactions → one category (+ optional subcategory) in
  // a single action, with the same pin/rule semantics as a single edit.
  const handleBulkCategoryChange = useCallback(
    async (txs: Transaction[], newCategory: string, newSubcategory: string | null, onlyThis: boolean) => {
      if (!sessionId) return
      const ids = txs.map((t) => t.id).filter((i): i is number => i != null)
      if (!ids.length) return
      try {
        const resp = await transactionsApi.bulkUpdateCategory(sessionId, ids, newCategory, newSubcategory, onlyThis)
        if (!ASSIGNABLE_CATEGORIES.includes(newCategory)) {
          addCustomCategory(newCategory)
          if (user) supabaseApi.upsertUserCategory(user.id, newCategory).catch(() => {})
        }
        if (newSubcategory) addCustomSubcategory(newCategory, newSubcategory)
        if (user) {
          if (onlyThis) {
            // Pin each selected row.
            await Promise.allSettled(resp.items.map((it) =>
              supabaseApi.upsertTransactionOverride(user.id, it.txn_key, newCategory, newSubcategory),
            ))
          } else {
            // One rule per unique merchant + unpin the selected rows.
            const merchants = Array.from(new Set(resp.items.map((it) => it.merchant).filter(Boolean)))
            await Promise.allSettled(merchants.map((m) =>
              newSubcategory
                ? supabaseApi.upsertCategorySubrule(user.id, m, newCategory, newSubcategory)
                : supabaseApi.upsertCategoryRule(user.id, m, newCategory),
            ))
            Promise.allSettled(resp.items.map((it) =>
              supabaseApi.deleteTransactionOverride(user.id, it.txn_key),
            )).catch(() => {})
          }
        }
      } finally {
        setRefreshKey((k) => k + 1)
        if (drawerOpen && drawerCategory) loadDrawerTransactions(drawerCategory, true)
      }
    },
    [sessionId, user, drawerOpen, drawerCategory, loadDrawerTransactions, addCustomCategory, addCustomSubcategory],
  )

  // ── Per-transaction note ──
  // Saves the note on the live session AND persists it in Supabase
  // (transaction_notes, keyed by fingerprint) so it survives restores.
  const handleSaveNote = useCallback(
    async (tx: Transaction, note: string) => {
      if (!sessionId || tx.id == null) return
      const resp = await transactionsApi.updateTransactionNote(sessionId, tx.id, note)
      if (user && resp.txn_key) {
        if (note.trim()) {
          await supabaseApi.upsertTransactionNote(user.id, resp.txn_key, note).catch(() => {})
        } else {
          await supabaseApi.deleteTransactionNote(user.id, resp.txn_key).catch(() => {})
        }
      }
      if (drawerOpen && drawerCategory) loadDrawerTransactions(drawerCategory, true)
    },
    [sessionId, user, drawerOpen, drawerCategory, loadDrawerTransactions],
  )

  // ── Push notifications to header notification center ──
  useEffect(() => {
    if (!metrics) return
    const items: { id: string; type: 'anomaly' | 'upload' | 'insight'; title: string; message: string; time: string; read: boolean }[] = []
    const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

    for (const a of anomalies) {
      items.push({ id: `anomaly-${a.date}-${a.description}`, type: 'anomaly', title: 'עסקה חריגה', message: `${a.description}`, time: now, read: false })
    }
    if (forecast && forecast.trend_direction === 'up') {
      items.push({ id: 'forecast-up', type: 'insight', title: 'תחזית הוצאות', message: 'מגמת עלייה בהוצאות', time: now, read: false })
    }
    if (metrics.total_income > 0 && Math.abs(metrics.total_expenses) > metrics.total_income) {
      items.push({ id: 'expenses-exceed-income', type: 'insight', title: 'הוצאות עולות על הכנסות', message: `הוצאות: ${Math.abs(metrics.total_expenses).toLocaleString('he-IL')} > הכנסות: ${metrics.total_income.toLocaleString('he-IL')}`, time: now, read: false })
    }
    setNotifications(items)
  }, [metrics, anomalies, forecast, setNotifications])

  // ── Inject responsive CSS once (prevent duplicate <style> elements) ──
  useEffect(() => {
    const STYLE_ID = 'dashboard-responsive-css'
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      @media (max-width: 768px) {
        .dashboard-premium-row,
        .dashboard-weekly-row,
        .dashboard-category-grid,
        .month-overview-grid { grid-template-columns: minmax(0, 1fr) !important; }
        .dashboard-monthly-comparison { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }
      @media (max-width: 420px) {
        .dashboard-monthly-comparison { grid-template-columns: minmax(0, 1fr) !important; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(STYLE_ID)?.remove() }
  }, [])

  // ── Load the list of people (owners) for the per-person filter ──
  useEffect(() => {
    if (!sessionId) { setOwners([]); return }
    const controller = new AbortController()
    transactionsApi.getOwners(sessionId, controller.signal)
      .then(setOwners)
      .catch(() => setOwners([]))
    return () => controller.abort()
  }, [sessionId, refreshKey])

  // Rebuild a lost backend session from the latest Supabase snapshot. Returns
  // true (and navigates to the fresh session) when it recovers. Guarded so a
  // genuinely broken backend can't cause an endless restore loop.
  const recoveryAttempts = useRef(0)
  const tryRecoverSession = useCallback(async (): Promise<boolean> => {
    if (!user || recoveryAttempts.current >= 2) return false
    recoveryAttempts.current += 1
    try {
      const [transactions, rules, overrides, customCats, notes] = await Promise.all([
        supabaseApi.getLatestTransactions(user.id),
        supabaseApi.getCategoryRules(user.id).catch(() => []),
        supabaseApi.getTransactionOverrides(user.id).catch(() => []),
        supabaseApi.getUserCategories(user.id).catch(() => []),
        supabaseApi.getTransactionNotes(user.id).catch(() => []),
      ])
      if (!transactions || transactions.length === 0) return false
      const restored = await transactionsApi.restoreSession(
        transactions as unknown[], rules, overrides, customCats.map((c) => c.name), notes)
      if (restored.success && restored.session_id) {
        navigate(`/?session_id=${restored.session_id}`, { replace: true })
        return true
      }
    } catch {
      // fall through — caller will surface the original error
    }
    return false
  }, [user, navigate])

  // ── Fetch all data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Re-scope to the selected person; reads use sid, edits use sessionId.
        const sid = await transactionsApi.scopeSession(sessionId, selectedOwner, signal, category, subcategories)
        const results = await Promise.all([
          transactionsApi.getMetrics(sid, signal),
          transactionsApi.getDonutChartV2(sid, signal),
          transactionsApi.getMonthlyChartV2(sid, dateType, signal),
          transactionsApi.getWeekdayChartV2(sid, signal),
          transactionsApi.getWeeklySummary(sid, signal).catch(() => null),
          transactionsApi.getForecast(sid, signal).catch(() => null),
          transactionsApi.getSpendingVelocity(sid, signal).catch(() => null),
          transactionsApi.getAnomalies(sid, signal).catch(() => null),
          transactionsApi.getIncomeSources(sid, signal).catch(() => null),
        ])

        setMetrics(results[0] as MetricsData)
        setDonutData(results[1] as RawDonutData)
        setMonthlyData(results[2] as RawMonthlyData)
        setWeekdayData(results[3] as RawWeekdayData)
        if (results[4]) setWeeklySummary(results[4] as WeeklySummaryData)
        if (results[5]) setForecast(results[5] as ForecastData)
        if (results[6]) setVelocity(results[6] as SpendingVelocityData)
        if (results[7]) setAnomalies((results[7] as { anomalies: AnomalyItem[] }).anomalies ?? [])
        setIncomeSources((results[8] as IncomeSourcesData) ?? null)

        recoveryAttempts.current = 0 // healthy load — allow future recovery

        // Auto-select the most recent month ONLY when nothing is selected yet
        // (or the remembered month no longer exists in the data). A refresh
        // after an edit must keep the user on the month they were viewing.
        const monthly = results[2] as RawMonthlyData
        if (monthly?.months?.length) {
          const months = monthly.months.map((m) => m.month)
          setSelectedMonth((prev) => {
            const next = defaultMonth(months, prev) || months[months.length-1]
            // Keep the snapshot range in step on first load / invalid month;
            // the selectedMonth sync effect handles user-driven changes.
            setSnapshotMonthFrom((f) => (f && months.includes(f) ? f : next))
            setSnapshotMonthTo((t) => (t && months.includes(t) ? t : next))
            return next
          })
        }
      } catch (err: unknown) {
        if ((err instanceof DOMException && err.name === 'AbortError') || (err as { name?: string })?.name === 'CanceledError') return
        if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'CanceledError') return
        // Stale in-memory session (e.g. backend cold-start on Render's free
        // tier) → rebuild it from Supabase and retry, instead of erroring.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 404 && (await tryRecoverSession())) return
        const message = err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [sessionId, dateType, refreshKey, selectedOwner, category, subcategories, tryRecoverSession])

  // ── Fetch month overview when selectedMonth changes ────────────────
  useEffect(() => {
    if (!sessionId || !selectedMonth) return
    const controller = new AbortController()

    const fetchOverview = async () => {
      setMonthOverviewLoading(true)
      setMonthOverview(null)
      try {
        const sid = await transactionsApi.scopeSession(sessionId, selectedOwner, controller.signal, category, subcategories)
        const data = await transactionsApi.getMonthOverview(sid, selectedMonth, dateType, controller.signal)
        if (!controller.signal.aborted) setMonthOverview(data)
      } catch {
        // non-critical
      } finally {
        if (!controller.signal.aborted) setMonthOverviewLoading(false)
      }
    }

    fetchOverview()
    return () => controller.abort()
  }, [sessionId, selectedMonth, dateType, refreshKey, selectedOwner, category, subcategories])

  // ── Derived data ───────────────────────────────────────────────────
  // List of months to show in selector (last 12 months)
  const availableMonths = useMemo(() => {
    if (!monthlyData?.months) return []
    const seen = new Set<string>()
    return [...monthlyData.months].reverse().filter((m) => {
      const key = formatMonthLabel(m.month)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 12)
  }, [monthlyData])

  const hasBillingDate = metrics?.has_billing_date ?? false

  // ── Sync category snapshot month with selectedMonth ──
  useEffect(() => {
    if (selectedMonth) {
      setSnapshotMonthFrom(selectedMonth)
      setSnapshotMonthTo(selectedMonth)
    }
  }, [selectedMonth])

  // ── Fetch category snapshot when month range or date type changes ──
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    transactionsApi.scopeSession(sessionId, selectedOwner, controller.signal, category, subcategories)
      .then((sid) => transactionsApi.getCategorySnapshot(
        sid, controller.signal,
        snapshotMonthFrom || undefined, snapshotMonthTo || undefined, dateType,
      ))
      .then((data) => setCategorySnapshot(data))
      .catch(() => {})
    return () => controller.abort()
  }, [sessionId, snapshotMonthFrom, snapshotMonthTo, dateType, refreshKey, selectedOwner, category, subcategories])

  // ── Fetch the category/subcategory catalog (seeded names + everything in
  // use in this session, so a subcategory created once stays pickable) ──
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    transactionsApi.getCategoryCatalog(controller.signal, sessionId)
      .then((data) => setCategoryCatalog(data))
      .catch(() => {})
    return () => controller.abort()
  }, [sessionId, refreshKey])

  // ── Load user-created category/subcategory names (localStorage) ──
  useEffect(() => {
    if (!user) return
    try {
      const c = localStorage.getItem(`customCats:${user.id}`)
      const s = localStorage.getItem(`customSubs:${user.id}`)
      setCustomCategories(c ? JSON.parse(c) : [])
      setCustomSubcategories(s ? JSON.parse(s) : {})
    } catch {
      // ignore malformed localStorage
    }
  }, [user])

  const handleManagerRename = useCallback(async (oldCategory: string, newCategory: string) => {
    if (!sessionId) return
    const next = newCategory.trim()
    if (!next || next === oldCategory) return
    try {
      const resp = await transactionsApi.renameCategory(sessionId, oldCategory, next)
      if (user && resp.merchants.length > 0) {
        await supabaseApi.upsertCategoryRules(
          user.id,
          resp.merchants.map((merchant) => ({ merchant, category: next })),
        ).catch(() => {})
      }
      setRefreshKey((k) => k + 1)
    } catch {
      // ignore — rename is best-effort
    }
  }, [sessionId, user])

  // ── Filtered + sorted snapshot categories (uses extracted pure fn) ────
  const snapshotFilterOpts = useMemo(() => ({
    search: snapshotSearch,
    excluded: snapshotExcluded,
    minAmount: snapshotMinAmount ? parseFloat(snapshotMinAmount) : 0,
    maxAmount: snapshotMaxAmount ? parseFloat(snapshotMaxAmount) : 0,
    selectedCategories: snapshotSelectedCats,
    sort: snapshotSort,
  }), [snapshotSearch, snapshotExcluded, snapshotMinAmount, snapshotMaxAmount, snapshotSelectedCats, snapshotSort])

  const sortedSnapshotCategories = useMemo(
    () => filterAndSortCategories(categorySnapshot?.categories ?? [], snapshotFilterOpts),
    [categorySnapshot, snapshotFilterOpts],
  )

  const snapshotFilteredTotal = useMemo(
    () => sortedSnapshotCategories.reduce((s, c) => s + c.total, 0),
    [sortedSnapshotCategories],
  )

  const snapshotActiveFilterCount = useMemo(
    () => countActiveFilters(snapshotFilterOpts),
    [snapshotFilterOpts],
  )

  const availableCategoryNames = useMemo(
    () => Array.from(new Set([
      ...(categorySnapshot?.categories.map((cat) => cat.name) ?? []),
      ...ASSIGNABLE_CATEGORIES,
      ...(categoryCatalog?.categories.map((c) => c.name) ?? []),
      ...customCategories,
    ]))
      .filter((c) => c !== 'אחר') // chart-legend bucket, not an assignable category
      .sort((a, b) => a.localeCompare(b, 'he')),
    [categorySnapshot, categoryCatalog, customCategories],
  )

  // Subcategory names for the category currently shown in the drawer (seeded ∪
  // user-created). The drawer additionally merges any in-use on its rows.
  const drawerSubcategoryOptions = useMemo(() => {
    const seeded = categoryCatalog?.subcategories?.[drawerCategory]?.map((s) => s.name) ?? []
    return Array.from(new Set([...seeded, ...(customSubcategories[drawerCategory] ?? [])]))
  }, [categoryCatalog, drawerCategory, customSubcategories])

  // Full parent→subcategories map, so the drawer's editor can offer the RIGHT
  // subcategory list for whichever category the user just picked (not only the
  // drawer's current category).
  const subcategoryCatalogMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const [parent, subs] of Object.entries(categoryCatalog?.subcategories ?? {})) {
      map[parent] = subs.map((s) => s.name)
    }
    for (const [parent, subs] of Object.entries(customSubcategories)) {
      map[parent] = Array.from(new Set([...(map[parent] ?? []), ...subs]))
    }
    return map
  }, [categoryCatalog, customSubcategories])

  // Category list for the manager modal: every known category + its subcategories.
  const managerCategories = useMemo<ManagerCategory[]>(() => {
    const names = new Set<string>([
      ...(categoryCatalog?.categories.map((c) => c.name) ?? ASSIGNABLE_CATEGORIES),
      ...(categorySnapshot?.categories.map((c) => c.name) ?? []),
      ...customCategories,
    ])
    names.delete('אחר') // chart-legend bucket, not a manageable category
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, 'he'))
      .map((name) => ({
        name,
        subcategories: Array.from(new Set([
          ...(categoryCatalog?.subcategories?.[name]?.map((s) => s.name) ?? []),
          ...(customSubcategories[name] ?? []),
        ])).sort((a, b) => a.localeCompare(b, 'he')),
      }))
  }, [categoryCatalog, categorySnapshot, customCategories, customSubcategories])

  const clearAllSnapshotFilters = useCallback(() => {
    setSnapshotSearch('')
    setSnapshotExcluded(new Set())
    setSnapshotMinAmount('')
    setSnapshotMaxAmount('')
    setSnapshotMonthFrom('')
    setSnapshotMonthTo('')
    setSnapshotSelectedCats(null)
  }, [])

  const startCategoryRename = useCallback((categoryName: string) => {
    setEditingCategoryName(categoryName)
    setCategoryRenameValue(categoryName)
  }, [])

  const cancelCategoryRename = useCallback(() => {
    setEditingCategoryName(null)
    setCategoryRenameValue('')
    setSavingCategoryName(null)
  }, [])

  const handleCategoryRename = useCallback(
    async (oldCategory: string) => {
      if (!sessionId) return
      const newCategory = categoryRenameValue.trim()
      if (!newCategory || newCategory === oldCategory) {
        cancelCategoryRename()
        return
      }

      setSavingCategoryName(oldCategory)
      try {
        const resp = await transactionsApi.renameCategory(sessionId, oldCategory, newCategory)
        if (user && resp.merchants.length > 0) {
          await supabaseApi.upsertCategoryRules(
            user.id,
            resp.merchants.map((merchant) => ({ merchant, category: newCategory })),
          ).catch((e) => {
            console.warn('Failed to persist category rename rules:', e)
          })
        }

        setSnapshotExcluded((prev) => {
          if (!prev.has(oldCategory)) return prev
          const next = new Set(prev)
          next.delete(oldCategory)
          next.add(newCategory)
          return next
        })
        setSnapshotSelectedCats((prev) => {
          if (!prev || !prev.has(oldCategory)) return prev
          const next = new Set(prev)
          next.delete(oldCategory)
          next.add(newCategory)
          return next
        })
        if (drawerCategory === oldCategory) setDrawerCategory(newCategory)
        setRefreshKey((k) => k + 1)
      } finally {
        cancelCategoryRename()
      }
    },
    [cancelCategoryRename, categoryRenameValue, drawerCategory, sessionId, user],
  )

  const monthExpensePie = useMemo<MonthLegendItem[]>(() => {
    if (!monthOverview) return []
    return monthOverview.categories
      .filter((item) => item.expenses > 0)
      .map((item) => ({ name: item.name, value: item.expenses }))
      .sort((a, b) => b.value - a.value)
  }, [monthOverview])

  const [showAllMonthCategories, setShowAllMonthCategories] = useState(false)
  const monthChartData = groupMonthCategories(monthExpensePie)

  // After the local bank-sync tool writes a fresh snapshot to Supabase, load it
  // through the normal restore path (same flow as a manual upload).
  const handleBankSynced = async () => {
    if (!user) return
    try {
      const [transactions, rules, overrides, customCats, notes] = await Promise.all([
        supabaseApi.getLatestTransactions(user.id),
        supabaseApi.getCategoryRules(user.id).catch(() => []),
        supabaseApi.getTransactionOverrides(user.id).catch(() => []),
        supabaseApi.getUserCategories(user.id).catch(() => []),
        supabaseApi.getTransactionNotes(user.id).catch(() => []),
      ])
      if (!transactions || transactions.length === 0) return
      const merged = await transactionsApi.restoreSession(
        transactions as unknown[], rules, overrides, customCats.map((c) => c.name), notes)
      if (merged.success && merged.session_id) {
        navigate(`/?session_id=${merged.session_id}`)
      }
    } catch (err) {
      console.error('Failed to reload after bank sync:', err)
    }
  }

  // ── No session ────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <>
        <EmptyState
          icon="🏦"
          title={'חברו את חשבונות הבנק והאשראי'}
          text={'סנכרנו את העסקאות ישירות מהבנקים וחברות האשראי — בלי להעלות קבצים ידנית.'}
        />

        {/* Primary action — pull transactions straight from the banks */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-lg)' }}>
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <RefreshFromBanks onSynced={handleBankSynced} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', margin: 0, textAlign: 'center' }}>
            דורש את כלי הסנכרון המקומי שרץ במחשב שלך · אפשר גם להעלות קובץ מהסרגל הצדי
          </p>
        </div>

        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
          <div className="feature-card"><div className="feature-icon">🔄</div><div className="feature-title">סנכרון אוטומטי</div><div className="feature-desc">לאומי, דיסקונט, MAX וישראכרט — ישירות לדאשבורד</div></div>
          <div className="feature-card"><div className="feature-icon">🏷️</div><div className="feature-title">קטגוריות אוטומטיות</div><div className="feature-desc">זיהוי חכם של קטגוריות לכל עסקה</div></div>
          <div className="feature-card"><div className="feature-icon">📊</div><div className="feature-title">ניתוח ויזואלי</div><div className="feature-desc">גרפים אינטראקטיביים ותובנות מיידיות</div></div>
        </div>
      </>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="card-grid-responsive">
          <Skeleton variant="card" count={4} />
        </div>
        <div className="bento-grid" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="bento-full"><Skeleton variant="rectangular" height={100} /></div>
          <div className="bento-2-3"><Skeleton variant="rectangular" height={300} /></div>
          <div className="bento-1-3"><Skeleton variant="rectangular" height={300} /></div>
          <div className="bento-full"><Skeleton variant="rectangular" height={320} /></div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-danger)', fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>{error}</p>
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => window.location.reload()}>נסה שוב</Button>
      </div>
    )
  }

  if (!metrics) return null

  // ── Main view ──────────────────────────────────────────────────────
  return (
    <div className="studio-dashboard" style={{ direction: 'rtl', position: 'relative' }}>
      {/* Mesh gradient background */}
      <div className="mesh-gradient-bg" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '300px', pointerEvents: 'none', zIndex: 0, opacity: 0.6 }} />

      <PageHeader
        title="מרכז הבקרה של הכסף שלך"
        subtitle="סקירה חודשית של ההוצאות, ההכנסות ומה שהשתנה"
        icon={LayoutDashboard}
        actions={<label className="dashboard-month-control">חודש לתצוגה
          <select aria-label="חודש לתצוגה" value={selectedMonth || ''} onChange={e => setSelectedMonth(e.target.value)}>
            {availableMonths.map(m => <option key={m.month} value={m.month}>{formatMonthLabel(m.month)}</option>)}
          </select>
        </label>}
      />

      <MonthlyPulse userId={user?.id || 'guest'} sessionId={sessionId} month={selectedMonth}
        overview={monthOverview} loading={monthOverviewLoading} dateType={dateType} owner={selectedOwner}
        category={category} subcategories={subcategories} refreshKey={refreshKey}
        onApplyView={(view) => { setCategory(view.category); setSubcategories(view.subcategories); setSelectedOwner(view.owner); setDateType(view.dateType) }}
        onCategory={handleCategoryCardClick}
        onTransactions={() => navigate(`/transactions?session_id=${sessionId}`)} />

      <details className="dashboard-filter-bar" aria-label="סינון קטגוריות"><summary><SlidersHorizontal size={16}/> סינון ומיקוד <span>{category || 'כל הקטגוריות'}{subcategories.length ? ` · ${subcategories.length} תתי-קטגוריות` : ''}</span></summary>
        <div className="dashboard-filter-heading">
          <div>
            <strong>מיקוד הדשבורד</strong>
            <span>בחר קטגוריה ותת-קטגוריה. כל המדדים והתצוגות יתעדכנו.</span>
          </div>
          {(Boolean(category) || subcategories.length > 0) && <button type="button" className="filter-clear-button" onClick={clearFilters}>נקה הכל</button>}
        </div>
        <div className="dashboard-filter-fields">
          <label>
            <span>קטגוריה</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">כל הקטגוריות</option>
              {availableCategoryNames.map((item) => <option key={item} value={item}>{get_icon(item)} {item}</option>)}
            </select>
          </label>
          <label>
            <span>תת-קטגוריה</span>
            <MultiSelect
              options={subcategoryCatalogMap[category] ?? []}
              value={subcategories}
              onChange={setSubcategories}
              placeholder="כל תתי-הקטגוריות"
              ariaLabel="בחירת מספר תתי-קטגוריות"
              disabled={!category}
            />
          </label>
        </div>
        {(Boolean(category) || subcategories.length > 0) && <div className="active-filter-summary">הדשבורד מסונן לפי: {[category, subcategories].filter(Boolean).join(' / ')}</div>}
      </details>

      {/* ── Per-person filter (הכל = everyone incl. shared; person chips
              only — "משותף"/shared rows are part of הכל, not a separate view) ── */}
      {owners.filter((o) => o !== 'משותף').length > 1 && (
        <div
          className="filter-chips"
          style={{ position: 'relative', zIndex: 1, marginBottom: 'var(--space-md)', alignItems: 'center' }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginInlineEnd: '4px' }}>תצוגה לפי:</span>
          <span
            className={`filter-chip ${!selectedOwner ? 'active' : ''}`}
            onClick={() => setSelectedOwner(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOwner(null) }}
          >
            הכל
          </span>
          {owners.filter((o) => o !== 'משותף').map((o) => (
            <span
              key={o}
              className={`filter-chip ${selectedOwner === o ? 'active' : ''}`}
              onClick={() => setSelectedOwner(o)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOwner(o) }}
            >
              {o === 'joint' ? 'משותף' : o}
            </span>
          ))}
        </div>
      )}



      {/* ── Date type toggle (billing / transaction) ───────────────── */}
      {hasBillingDate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="studio-date-toggle" style={{ marginBottom: 'var(--space-md)', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
        >
          <CreditCard size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>קיבוץ לפי:</span>
          <div style={{ display: 'flex', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(['transaction', 'billing'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDateType(type)}
                style={{
                  padding: '5px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: dateType === type ? 'var(--accent)' : 'transparent',
                  color: dateType === type ? 'var(--on-accent, #fff)' : 'var(--text-secondary)',
                }}
              >
                {type === 'transaction' ? 'תאריך עסקה' : 'תאריך חיוב'}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Month selector + overview ──────────────────────────────── */}
      {availableMonths.length > 0 && (
        <motion.div className="studio-breakdown"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          {/* Section header */}
          <div className="section-header-v2">
            <Calendar size={18} />
            <span>פילוח חודשי</span>
            {hasBillingDate && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
                {dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'}
              </span>
            )}
          </div>

          {/* Month overview content */}
          {monthOverviewLoading ? (
            <Skeleton variant="rectangular" height={320} />
          ) : monthOverview && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              gap: 'var(--space-md)',
            }}
              className="month-overview-grid"
            >
              <>
                {monthExpensePie.length > 0 && (
                  <Card variant="glass" padding="md" className="month-breakdown-pie-card">
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      הרכב ההוצאות - {formatMonthLabel(monthOverview.month)}
                    </div>
                    <div className="monthly-pie-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div><DonutChart data={monthChartData} total={monthOverview.total_expenses} /><div className="ring-key">{monthChartData.map(item=><span key={item.name}><i style={{background:categoryColor(item.name)}}/>{item.name}</span>)}</div></div>
                      <div className="month-pie-legend">
                        {(showAllMonthCategories ? monthExpensePie : monthChartData).map((item) => {
                          const pct = monthOverview.total_expenses > 0 ? item.value / monthOverview.total_expenses * 100 : 0
                          return <button type="button" onClick={() => item.aggregate ? setShowAllMonthCategories(true) : handleCategoryCardClick(item.name)} key={`${item.aggregate ? "group" : "category"}:${item.name}`} className="month-pie-legend-row">
                            <span className="month-pie-color" style={{background:categoryColor(item.name)}} />
                            <span className="month-pie-name">{item.name}</span>
                            <span className="month-pie-share"><i style={{width:`${pct}%`}}/></span><span className="month-pie-percent">{pct.toFixed(0)}%</span>
                            <strong>{formatCurrency(item.value)}</strong>
                          </button>
                        })}
                        {monthExpensePie.length > 7 && <button className="month-legend-expand" onClick={() => setShowAllMonthCategories(v => !v)}>{showAllMonthCategories ? 'הצג פחות' : `כל ${monthExpensePie.length} הקטגוריות`}</button>}
                      </div>
                    </div>
                  </Card>
                )}
              </>

            </div>
          )}
        </motion.div>
      )}

      {/* ── Full Category Snapshot ──────────────────────────────────── */}
      {categorySnapshot && categorySnapshot.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          {/* ─── Header ─── */}
          <div className="section-header-v2" style={{ flexWrap: 'wrap' }}>
            <Grid3X3 size={18} />
            <span>סיכום הוצאות לפי קטגוריה</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {snapshotMonthFrom || snapshotMonthTo
                ? (snapshotMonthFrom && snapshotMonthTo && snapshotMonthFrom === snapshotMonthTo
                    ? snapshotMonthFrom
                    : `${snapshotMonthFrom || '...'} — ${snapshotMonthTo || '...'}`)
                : `כל התקופה · ${categorySnapshot.month_count} חודשים`}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontWeight: 500, fontStyle: 'italic' }}>
              לחצו על קטגוריה לפירוט עסקאות
            </span>
            <button
              onClick={() => setManagerOpen(true)}
              style={{
                marginInlineStart: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: 'var(--glass-bg)',
                color: 'var(--text-secondary)',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              <Tag size={12} /> נהל קטגוריות
            </button>
          </div>

          {/* ─── Toolbar: Search + Sort + Actions (always visible) ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 200px', maxWidth: '280px', position: 'relative' }}>
              <Search size={13} style={{ color: 'var(--text-muted)', position: 'absolute', right: '8px', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="חיפוש קטגוריה או בית עסק..." aria-label="חיפוש קטגוריה או בית עסק"
                value={snapshotSearch}
                onChange={(e) => setSnapshotSearch(e.target.value)}
                style={{
                  width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
                  padding: '6px 32px 6px 10px', fontSize: '0.75rem', fontFamily: 'var(--font-family)',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
              />
              {snapshotSearch && (
                <button onClick={() => setSnapshotSearch('')} style={{ position: 'absolute', left: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={12} style={{ color: 'var(--text-muted)' }} />
              {([
                { key: 'amount' as const, label: 'סכום' },
                { key: 'change' as const, label: 'שינוי' },
                { key: 'count' as const, label: 'כמות' },
                { key: 'avg' as const, label: 'ממוצע' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSnapshotSort(opt.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                    borderColor: snapshotSort === opt.key ? 'var(--accent)' : 'var(--border)',
                    background: snapshotSort === opt.key ? 'var(--accent-muted)' : 'transparent',
                    color: snapshotSort === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: snapshotSort === opt.key ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Advanced toggle + Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
              <button
                onClick={() => setSnapshotShowAdvanced(!snapshotShowAdvanced)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                  borderColor: snapshotShowAdvanced ? 'var(--accent)' : 'var(--border)',
                  background: snapshotShowAdvanced ? 'var(--accent-muted)' : 'transparent',
                  color: snapshotShowAdvanced ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-family)', display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <SlidersHorizontal size={11} />
                מתקדם
                {snapshotActiveFilterCount > 0 && (
                  <span style={{
                    minWidth: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)',
                    color: 'var(--on-accent, #fff)', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>{snapshotActiveFilterCount}</span>
                )}
              </button>
              {snapshotActiveFilterCount > 0 && (
                <button
                  onClick={clearAllSnapshotFilters}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--danger)',
                    background: 'transparent', color: 'var(--danger)', fontSize: '0.6875rem',
                    fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-family)',
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                  }}
                >
                  <X size={10} />
                  נקה הכל
                </button>
              )}
            </div>
          </div>

          {/* ─── Category chip multi-select (always visible) ─── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {/* Select All / Deselect All */}
            <button
              onClick={() => setSnapshotSelectedCats(snapshotSelectedCats === null ? new Set() : null)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: snapshotSelectedCats === null ? 'var(--accent-muted)' : 'transparent',
                color: snapshotSelectedCats === null ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-family)', transition: 'all 0.15s',
              }}
            >
              {snapshotSelectedCats === null ? 'הכל' : 'בחר הכל'}
            </button>
            {categorySnapshot.categories.filter((c, i) => !isNarrow || chipsOpen || i < 5 || snapshotExcluded.has(c.name) || (snapshotSelectedCats !== null && !snapshotSelectedCats.has(c.name))).map((cat) => {
              const isSelected = snapshotSelectedCats === null || snapshotSelectedCats.has(cat.name)
              const isExcluded = snapshotExcluded.has(cat.name)
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    if (isExcluded) {
                      setSnapshotExcluded(prev => { const n = new Set(prev); n.delete(cat.name); return n })
                      return
                    }
                    if (snapshotSelectedCats === null) {
                      // First deselection: select all except this one
                      const all = new Set(categorySnapshot.categories.map(c => c.name))
                      all.delete(cat.name)
                      setSnapshotSelectedCats(all)
                    } else if (isSelected) {
                      const next = new Set(snapshotSelectedCats)
                      next.delete(cat.name)
                      setSnapshotSelectedCats(next.size === 0 ? null : next)
                    } else {
                      const next = new Set(snapshotSelectedCats)
                      next.add(cat.name)
                      // If all are now selected, reset to null (= "all")
                      setSnapshotSelectedCats(next.size === categorySnapshot.categories.length ? null : next)
                    }
                  }}
                  style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isExcluded ? 'var(--danger-muted)' : isSelected ? 'var(--accent-muted)' : 'transparent',
                    color: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: isSelected ? 500 : 400, cursor: 'pointer',
                    fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    textDecoration: isExcluded ? 'line-through' : 'none',
                    opacity: isExcluded ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}><Tag size={18}/></span>
                  {cat.name}
                  <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>({cat.percent.toFixed(1)}%)</span>
                </button>
              )
            })}
            {isNarrow && categorySnapshot.categories.length > 5 && (
              <button
                onClick={() => setChipsOpen(o => !o)}
                aria-expanded={chipsOpen}
                style={{
                  padding: '4px 12px', minHeight: 36, borderRadius: 'var(--radius-full)',
                  border: '1px dashed var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-family)',
                }}
              >
                {chipsOpen ? 'הצג פחות' : `עוד ${categorySnapshot.categories.length - 5} קטגוריות`}
              </button>
            )}
          </div>

          {/* ─── Advanced filters panel (collapsible) ─── */}
          {snapshotShowAdvanced && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
              marginBottom: '10px', padding: '10px 14px',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}>
              {/* Amount range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>סכום:</span>
                <input type="number" placeholder="מינימום" value={snapshotMinAmount} onChange={(e) => setSnapshotMinAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>—</span>
                <input type="number" placeholder="מקסימום" value={snapshotMaxAmount} onChange={(e) => setSnapshotMaxAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
              </div>

              {/* Month range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>תקופה:</span>
                <select value={snapshotMonthFrom} onChange={(e) => setSnapshotMonthFrom(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">מתחילת התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>עד</span>
                <select value={snapshotMonthTo} onChange={(e) => setSnapshotMonthTo(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">סוף התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
              </div>

              {/* Excluded chips */}
              {snapshotExcluded.size > 0 && (
                <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', alignSelf: 'center' }}>מוחרגות:</span>
                  {[...snapshotExcluded].map((name) => (
                    <span key={name} onClick={() => { const n = new Set(snapshotExcluded); n.delete(name); setSnapshotExcluded(n) }}
                      style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--danger-muted)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {name} <X size={9} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Results summary ─── */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              {sortedSnapshotCategories.length === categorySnapshot.categories.length
                ? `${categorySnapshot.categories.length} קטגוריות · ${categorySnapshot.total_count === 1 ? 'עסקה אחת' : `${categorySnapshot.total_count} עסקאות`}`
                : `מציג ${sortedSnapshotCategories.length} מתוך ${categorySnapshot.categories.length} קטגוריות`
              }
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>
              סה״כ: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(snapshotFilteredTotal)}</strong>
              {sortedSnapshotCategories.length < categorySnapshot.categories.length && categorySnapshot.total > 0 && (
                <> ({((snapshotFilteredTotal / categorySnapshot.total) * 100).toFixed(1)}%)</>
              )}
            </span>
          </div>

          {/* ─── Category cards grid ─── */}
          <div className="dashboard-category-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: 'var(--space-sm)',
          }}>
            {(snapshotExpanded ? sortedSnapshotCategories : sortedSnapshotCategories.slice(0, 8)).map((cat) => {
              const changeColor = cat.month_change > 5 ? 'var(--danger)' : cat.month_change < -5 ? 'var(--success)' : 'var(--text-muted)'
              const changeBg = cat.month_change > 5 ? 'var(--danger-muted)' : cat.month_change < -5 ? 'var(--success-muted)' : 'rgba(148, 163, 184, 0.1)'
              const isRenaming = editingCategoryName === cat.name
              const isSavingRename = savingCategoryName === cat.name
              return (
                <div key={cat.name} className="studio-category" style={{ cursor: 'pointer' }}>
                <Card
                  variant="glass"
                  padding="sm"
                  hover
                  onClick={() => handleCategoryCardClick(cat.name)}
                >
                  <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                    {/* Exclude button */}
                    <button
                      className="category-hide-btn"
                      onClick={(e) => { e.stopPropagation(); setSnapshotExcluded(prev => new Set([...prev, cat.name])) }}
                      title={`הסתר ${cat.name}`}
                      style={{
                        position: 'absolute', top: '-2px', left: '-2px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, opacity: 0.4, transition: 'all 0.15s', zIndex: 2,
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.color = 'var(--danger)' }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4'; (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
                    >
                      <X size={9} />
                    </button>
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                    }}>
                      <Tag size={18}/>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Name + Total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        {isRenaming ? (
                          <form
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleCategoryRename(cat.name)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}
                          >
                            <input
                              value={categoryRenameValue}
                              onChange={(e) => setCategoryRenameValue(e.target.value)}
                              autoFocus
                              disabled={isSavingRename}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                border: '1px solid var(--accent)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-family)',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="submit"
                              disabled={isSavingRename || !categoryRenameValue.trim()}
                              title="שמור"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid var(--accent)',
                                background: 'var(--accent)',
                                color: 'var(--on-accent, #fff)',
                                cursor: isSavingRename ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelCategoryRename}
                              title="בטל"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <X size={12} />
                            </button>
                          </form>
                        ) : (
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cat.name}
                          </span>
                        )}
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', flexShrink: 0 }}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>

                      {/* Row 2: Stats chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                        {!isRenaming && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startCategoryRename(cat.name)
                            }}
                            aria-label="ערוך שם קטגוריה" title="ערוך שם קטגוריה"
                            style={{
                              height: 36, minWidth: 36,
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '0 8px',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-family)',
                            }}
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
                        {/* Transaction count */}
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Tag size={10} />
                          {cat.count === 1 ? 'עסקה אחת' : `${cat.count} עסקאות`}
                        </span>
                        {/* Percentage */}
                        <span style={{ fontSize: '0.625rem', color: 'var(--accent)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)' }}>
                          {cat.percent.toFixed(1)}%
                        </span>
                        {/* Month-over-month change */}
                        {cat.month_change !== 0 && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 600,
                            padding: '1px 6px', borderRadius: 'var(--radius-full)',
                            background: changeBg, color: changeColor,
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                          }}>
                            {cat.month_change > 0 ? '↑' : '↓'}{Math.abs(cat.month_change).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Row 3: Analytical details */}
                      <details className="category-extra" onClick={e => e.stopPropagation()}><summary>פרטים נוספים</summary><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          ממוצע: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.avg_transaction)}</strong>
                        </span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          חודשי: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.monthly_avg)}</strong>
                        </span>
                      </div>

                      {/* Row 4: Top merchant */}
                      {cat.top_merchant && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <bdi>{cat.top_merchant}</bdi> ({formatCurrency(cat.top_merchant_total)})
                        </div>
                      )}

                      </details>
                      {/* Row 5: Progress bar + mini sparkline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(cat.percent, 100)}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        {cat.sparkline && cat.sparkline.length > 1 && (
                          <div style={{ flexShrink: 0, opacity: 0.7 }}>
                            <SparklineChart data={cat.sparkline} color="var(--accent)" width={60} height={16} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              )
            })}
          </div>

          {/* Show more / less toggle */}
          {sortedSnapshotCategories.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-sm)' }}>
              <button
                onClick={() => setSnapshotExpanded(!snapshotExpanded)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 20px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'all 0.15s',
                }}
              >
                {snapshotExpanded
                  ? 'הצג פחות'
                  : `הצג עוד ${sortedSnapshotCategories.length - 8} קטגוריות`
                }
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Income sources (where income came from) ────────────────── */}
      {incomeSources && incomeSources.sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="section-header-v2" style={{ flexWrap: 'wrap' }}>
            <span>מקורות הכנסה</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 600 }}>כל התקופה</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
              {formatCurrency(incomeSources.total)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-5)',
            }}
          >
            {incomeSources.sources.map((s, i) => {
              const pct = incomeSources.total > 0 ? (s.value / incomeSources.total) * 100 : 0
              const color = INCOME_COLORS[i % INCOME_COLORS.length]
              return (
                <div key={s.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '6px', minWidth: 0 }}>
                    <span className="category-dot" style={{ background: color }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                      {s.name}
                      {s.count > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}> · {s.count}</span>}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>{Math.round(pct)}%</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)', direction: 'ltr', flexShrink: 0 }}>
                      {formatCurrency(s.value)}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 1.5)}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Multi-month composition comparison ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
      >
        <Card
          className="glass-card"
          padding="md"
          hover
          onClick={() => navigate(`/monthly?session_id=${sessionId}`)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>השוואת חודשים</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                השוואת הרכב ההוצאות בין כמה חודשים, לפי קטגוריה ותת-קטגוריה
              </div>
            </div>
            <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </Card>
      </motion.div>

      {/* ── Weekly Summary ─────────────────────────────────────────── */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="dashboard-weekly-row"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>השבוע</span>
              {weeklySummary.change_pct !== 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: weeklySummary.change_pct > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(52, 211, 153, 0.12)', color: weeklySummary.change_pct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--success)' }}>
                  {weeklySummary.change_pct > 0 ? '↑' : '↓'} {Math.abs(weeklySummary.change_pct)}%
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.this_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.this_week.count} עסקאות{weeklySummary.this_week.top_category ? ` · ${weeklySummary.this_week.top_category}` : ''}</p>
          </div>
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>שבוע שעבר</span>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.last_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.last_week.count} עסקאות{weeklySummary.last_week.top_category ? ` · ${weeklySummary.last_week.top_category}` : ''}</p>
          </div>
        </motion.div>
      )}

      {/* Bento grid charts removed — data available in ניהול נתונים */}

      {/* ── Forecast & Velocity ────────────────────────────────────── */}
      {(forecast || velocity) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
          style={{ display: 'grid', gridTemplateColumns: forecast && velocity ? '1fr 1fr' : '1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}
          className="dashboard-premium-row"
        >
          {forecast && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <TrendingUp size={18} />
                <span title="תחזית לינארית על חודשים קלנדריים מלאים (לפי תאריך העסקה, בלי החודש הנוכחי). שונה מסרגל החודשים למעלה שמבוסס על תאריך חיוב.">תחזית חודש הבא</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <AnimatedNumber
                  value={forecast.forecast_amount}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: forecast.trend_direction === 'up' ? 'rgba(239, 68, 68, 0.12)' : forecast.trend_direction === 'down' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(148, 163, 184, 0.12)', color: forecast.trend_direction === 'up' ? 'var(--accent-danger, #ef4444)' : forecast.trend_direction === 'down' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {forecast.trend_direction === 'up' ? '↑ עלייה' : forecast.trend_direction === 'down' ? '↓ ירידה' : '→ יציב'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title={forecast.confidence === 'high'
                    ? 'רמת ביטחון גבוהה: 6+ חודשי נתונים עם מגמה עקבית (R² > 0.7)'
                    : forecast.confidence === 'medium'
                      ? 'רמת ביטחון בינונית: 3+ חודשי נתונים עם מגמה מתונה (R² > 0.4)'
                      : `רמת ביטחון נמוכה: ${(forecast.monthly_data?.length ?? 0) < 3 ? 'פחות מ-3 חודשי נתונים' : 'תנודתיות גבוהה בין חודשים'} — ככל שיצטברו נתונים התחזית תשתפר`}
                >
                  ביטחון: {forecast.confidence === 'high' ? 'גבוה' : forecast.confidence === 'medium' ? 'בינוני' : 'נמוך'} ⓘ
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title={`ממוצע ההוצאות לחודש קלנדרי מלא (לפי תאריך העסקה, בנפרד מסרגל החודשים שמבוסס על תאריך חיוב), על פני ${forecast.monthly_data?.length ?? 0} חודשים, בלי החודש הנוכחי. התחזית מבוססת על מגמת שינוי ולא על הממוצע בלבד`}
                >
                  ממוצע בפועל: {formatCurrency(forecast.avg_monthly)}
                </span>
              </div>
              {forecast.monthly_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={forecast.monthly_data.map((m) => m.amount)} color="var(--neon-cyan, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
            </Card>
          )}

          {velocity && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <Zap size={18} />
                <span>קצב הוצאות</span>
              </div>
              <div className="velocity-stats" style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>יומי</div>
                  <AnimatedNumber value={velocity.daily_avg} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>7 ימים</div>
                  <AnimatedNumber value={velocity.rolling_7day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>30 יום</div>
                  <AnimatedNumber value={velocity.rolling_30day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
              </div>
              {velocity.daily_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={velocity.daily_data.map((d) => d.amount)} color="var(--neon-purple, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
              {/* Monthly burn-down progress bar */}
              {forecast && forecast.avg_monthly > 0 && (() => {
                const last30Total = velocity.rolling_30day * 30
                const burnPct = Math.min((last30Total / forecast.avg_monthly) * 100, 100)
                const isOver = last30Total > forecast.avg_monthly
                return (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'help' }} title="סך ההוצאות ב-30 הימים האחרונים (ממוצע יומי כפול 30) מול ממוצע ההוצאות החודשי. לא קשור ליעדי התקציב.">הוצאות 30 יום מול ממוצע חודשי</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {burnPct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${burnPct}%`,
                        borderRadius: '3px',
                        background: isOver
                          ? 'linear-gradient(90deg, var(--danger), #fb923c)'
                          : burnPct > 75
                            ? 'linear-gradient(90deg, var(--warning), #fbbf24)'
                            : 'linear-gradient(90deg, var(--success), #6ee7b7)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })()}
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Month-over-Month ───────────────────────────────────────── */}
      {monthlyData && monthlyData.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          <div className="section-header-v2">
            <BarChart3 size={18} />
            <span>השוואת חודשים</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
              {Math.min(monthlyData.months.length, 6)} חודשים אחרונים
            </span>
          </div>
          <Card className="glass-card" padding="md">
            <div
              style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(monthlyData.months.length, 6)}, 1fr)`, gap: 'var(--space-sm)' }}
              className="dashboard-monthly-comparison"
            >
              {monthlyData.months.slice(-6).map((month, idx, arr) => {
                const prev = idx > 0 ? arr[idx - 1].amount : null
                const changePct = prev ? ((month.amount - prev) / Math.abs(prev)) * 100 : null
                const isSelected = month.month === selectedMonth
                return (
                  <button type="button"
                    key={month.month}
                    onClick={() => setSelectedMonth(month.month)}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-md)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '6px', fontWeight: isSelected ? 600 : 400 }}>
                      {month.month}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                      {formatCurrency(month.amount)}
                    </div>
                    <div className="month-bar-track"><i style={{height:`${Math.max(2,month.amount/Math.max(...monthlyData.months.map(m=>m.amount))*100)}%`}}/></div>
                    {changePct !== null && (
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, marginTop: '6px', color: changePct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--success)' }}>
                        {changePct > 0 ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}%
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Category Transactions Drawer ────────────────────────────── */}
      <CategoryTransactionsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        category={drawerCategory}
        month={
          snapshotMonthFrom || snapshotMonthTo
            ? (snapshotMonthFrom && snapshotMonthTo && snapshotMonthFrom === snapshotMonthTo
                ? snapshotMonthFrom
                : `${snapshotMonthFrom || '...'} — ${snapshotMonthTo || '...'}`)
            : ''
        }
        transactions={drawerTransactions}
        total={drawerTotal}
        loading={drawerLoading}
        error={drawerError}
        onRetry={() => drawerCategory && loadDrawerTransactions(drawerCategory)}
        availableCategories={availableCategoryNames}
        onCategoryChange={handleCategoryChange}
        subcategoryOptions={drawerSubcategoryOptions}
        subcategoryCatalog={subcategoryCatalogMap}
        onSubcategoryChange={handleSubcategoryChange}
        onSaveNote={handleSaveNote}
        onBulkCategoryChange={handleBulkCategoryChange}
      />

      <CategoryManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        categories={managerCategories}
        onRenameCategory={handleManagerRename}
        onAddCategory={addCustomCategory}
        onAddSubcategory={addCustomSubcategory}
      />
    </div>
  )
                  }
