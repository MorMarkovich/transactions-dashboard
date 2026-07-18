/**
 * API client for backend communication
 */
import axios from 'axios';
import type {
  TransactionResponse,
  MetricsData,
  FileUploadResponse,
  ChartData,
  TransactionFilters,
  RawDonutData,
  IncomeSourcesData,
  RawMonthlyData,
  RawWeekdayData,
  RawTrendData,
  InsightData,
  MerchantData,
  TrendStats,
  HeatmapData,
  RecurringData,
  ForecastData,
  WeeklySummaryData,
  SpendingVelocityData,
  AnomalyData,
  SearchResult,
  MonthOverviewData,
  CategoryAuditProposal,
  IndustryMonthlyData,
  CategorySnapshotData,
  CategoryTransactionsData,
  CategoryMerchantsData,
  CategoryMonthlyComparisonData,
  CategoryCatalog,
  CategoryRule,
  SessionInfo,
  SessionFileInfo,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const transactionsApi = {
  /**
   * List the distinct owners (people) present in the session, for the
   * per-person filter. Returns [] when transactions aren't owner-tagged.
   */
  getOwners: async (sessionId: string, signal?: AbortSignal): Promise<string[]> => {
    const response = await api.get<string[]>('/api/owners', { params: { sessionId }, signal });
    return response.data;
  },

  /**
   * Resolve a session id filtered to a single owner. Pass the returned id to
   * the other read endpoints so every chart/metric reflects that person.
   * An empty owner returns the base session unchanged.
   */
  scopeSession: async (sessionId: string, owner: string | null, signal?: AbortSignal): Promise<string> => {
    if (!owner) return sessionId;
    const response = await api.post<{ session_id: string }>('/api/session/scope', {
      session_id: sessionId,
      owner,
    }, { signal });
    return response.data.session_id || sessionId;
  },

  /**
   * Restore a backend session from saved transaction JSON data.
   * Optionally pass user-defined merchant→category rules; the backend
   * applies them after auto-categorization so they always win.
   */
  restoreSession: async (
    transactions: unknown[],
    categoryRules: CategoryRule[] = [],
    transactionOverrides: { txn_key: string; category: string; subcategory?: string | null }[] = [],
    customCategories: string[] = [],
    transactionNotes: { txn_key: string; note: string }[] = [],
  ): Promise<FileUploadResponse> => {
    const response = await api.post<FileUploadResponse>('/api/restore-session', {
      transactions,
      category_rules: categoryRules,
      transaction_overrides: transactionOverrides,
      custom_categories: customCategories,
      transaction_notes: transactionNotes,
    });
    return response.data;
  },

  /**
   * Run the slow AI fallback (Claude + web search) on the session's remaining
   * "שונות" merchants. Called in the background after restoreSession so the
   * dashboard paints immediately; returns assignments to persist as rules.
   */
  aiCategorize: async (sessionId: string): Promise<{ ai_categorized?: { merchant: string; category: string }[] }> => {
    const response = await api.post<{ ai_categorized?: { merchant: string; category: string }[] }>(
      '/api/ai-categorize',
      { session_id: sessionId },
    );
    return response.data;
  },

  /**
   * AI subcategory split: groups one category's unsubcategorized merchants
   * into subcategories — reusing existing names or creating new ones (e.g.
   * מזון וצריכה → סופרים). Applied to the live session server-side; the
   * returned assignments must be persisted as merchant rules by the caller.
   */
  aiSubcategorize: async (
    sessionId: string,
    category: string,
  ): Promise<{ assignments: { merchant: string; category: string; subcategory: string; count: number; total: number }[]; remaining: number }> => {
    const response = await api.post<{ assignments: { merchant: string; category: string; subcategory: string; count: number; total: number }[]; remaining: number }>(
      '/api/ai-subcategorize',
      { session_id: sessionId, category },
    );
    return response.data;
  },

  /**
   * Fully automatic subcategory sweep: every category with unsubcategorized
   * rows (except שונות). Fired in the background after restore, chained after
   * aiCategorize — no user action needed. Returned assignments must be
   * persisted as merchant rules by the caller.
   */
  aiSubcategorizeAll: async (
    sessionId: string,
  ): Promise<{ assignments: { merchant: string; category: string; subcategory: string; count: number; total: number }[]; remaining: number }> => {
    const response = await api.post<{ assignments: { merchant: string; category: string; subcategory: string; count: number; total: number }[]; remaining: number }>(
      '/api/ai-subcategorize-all',
      { session_id: sessionId },
    );
    return response.data;
  },

  /**
   * Live progress of the background AI chain, for the UI meter.
   * stage: idle | categorizing | categorized | subcategorizing | done.
   */
  aiProgress: async (
    sessionId: string,
  ): Promise<{ stage: string; done: number; total: number; detail: string }> => {
    const response = await api.get<{ stage: string; done: number; total: number; detail: string }>(
      '/api/ai-progress',
      { params: { sessionId } },
    );
    return response.data;
  },

  /**
   * AI audit: second opinion on ALL expense merchants (not just שונות).
   * Returns proposals where Claude disagrees with the current category —
   * nothing is applied until the user accepts a proposal.
   */
  aiAudit: async (
    sessionId: string,
    excludeMerchants: string[] = [],
    limit = 60,
  ): Promise<{
    proposals: CategoryAuditProposal[];
    verified: { merchant: string; category: string }[];
    audited_count: number;
    audited_merchants: string[];
    remaining: number;
  }> => {
    const response = await api.post<{
      proposals: CategoryAuditProposal[];
      verified: { merchant: string; category: string }[];
      audited_count: number;
      audited_merchants: string[];
      remaining: number;
    }>(
      '/api/ai-audit',
      { session_id: sessionId, exclude_merchants: excludeMerchants, limit },
      { timeout: 300000 }, // Claude + web search over dozens of merchants is slow
    );
    return response.data;
  },

  /**
   * Reclassify every transaction of a merchant (canonical-key match) in the
   * live session. Caller persists the same mapping as a Supabase rule.
   */
  setMerchantCategory: async (
    sessionId: string,
    merchant: string,
    category: string,
  ): Promise<{ success: boolean; merchant: string; category: string; affected_count: number }> => {
    const response = await api.post<{ success: boolean; merchant: string; category: string; affected_count: number }>(
      '/api/merchants/category',
      { session_id: sessionId, merchant, category },
    );
    return response.data;
  },

  /**
   * List source files in the current session
   */
  getSessionFiles: async (sessionId: string): Promise<{ files: SessionFileInfo[] }> => {
    const response = await api.get<{ files: SessionFileInfo[] }>('/api/session-files', {
      params: { sessionId },
    });
    return response.data;
  },

  /**
   * Remove all transactions from a specific source file
   */
  deleteSessionFile: async (sessionId: string, fileName: string): Promise<{ success: boolean; removed: number; remaining: number; message: string }> => {
    const response = await api.delete<{ success: boolean; removed: number; remaining: number; message: string }>('/api/session-files', {
      params: { sessionId, file_name: fileName },
    });
    return response.data;
  },

  /**
   * Delete entire session (clear all in-memory data)
   */
  deleteSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>('/api/session', {
      params: { sessionId },
    });
    return response.data;
  },

  /**
   * Upload transaction file
   */
  uploadFile: async (file: File, signal?: AbortSignal): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<FileUploadResponse>('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });

    return response.data;
  },

  /**
   * Get transactions with filters
   */
  getTransactions: async (
    sessionId: string,
    filters?: TransactionFilters,
    signal?: AbortSignal
  ): Promise<TransactionResponse> => {
    const params = new URLSearchParams();
    params.append('sessionId', sessionId);

    if (filters) {
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.min_amount != null) params.append('min_amount', filters.min_amount.toString());
      if (filters.max_amount != null) params.append('max_amount', filters.max_amount.toString());
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.page_size) params.append('page_size', filters.page_size.toString());
    }

    const response = await api.get<TransactionResponse>(`/api/transactions?${params.toString()}`, {
      signal,
    });
    return response.data;
  },

  /**
   * Update manual notes (הערות) for a single transaction
   */
  updateTransactionNote: async (
    sessionId: string,
    transactionId: number,
    notes: string,
  ): Promise<{ success: boolean; txn_key: string | null; notes: string | null }> => {
    const response = await api.post<{ success: boolean; txn_key: string | null; notes: string | null }>('/api/transactions/note', {
      session_id: sessionId,
      transaction_id: transactionId,
      notes,
    });
    return response.data;
  },

  /**
   * Reclassify a transaction's קטגוריה. Returns the merchant string so
   * the caller can persist a merchant→category rule.
   */
  updateTransactionCategory: async (
    sessionId: string,
    transactionId: number,
    category: string,
    onlyThis: boolean = false,
  ): Promise<{ success: boolean; merchant: string | null; category: string; txn_key: string | null; locked: boolean }> => {
    const response = await api.post<{ success: boolean; merchant: string | null; category: string; txn_key: string | null; locked: boolean }>(
      '/api/transactions/category',
      {
        session_id: sessionId,
        transaction_id: transactionId,
        category,
        only_this: onlyThis,
      },
    );
    return response.data;
  },

  /**
   * Rename or merge a category across the active backend session. Returns
   * affected merchant descriptions so the caller can persist category rules.
   */
  /**
   * Set a single transaction's subcategory. Returns the merchant + its current
   * category so the caller can persist a merchant→{category, subcategory} rule.
   */
  updateTransactionSubcategory: async (
    sessionId: string,
    transactionId: number,
    subcategory: string,
    onlyThis: boolean = false,
  ): Promise<{ success: boolean; merchant: string | null; category: string | null; subcategory: string; txn_key: string | null; locked: boolean }> => {
    const response = await api.post<{ success: boolean; merchant: string | null; category: string | null; subcategory: string; txn_key: string | null; locked: boolean }>(
      '/api/transactions/subcategory',
      {
        session_id: sessionId,
        transaction_id: transactionId,
        subcategory,
        only_this: onlyThis,
      },
    );
    return response.data;
  },

  /**
   * Get the seeded category + subcategory catalog (names + icons) so the UI's
   * category manager and subcategory selectors stay in sync with the backend.
   */
  getCategoryCatalog: async (signal?: AbortSignal, sessionId?: string): Promise<CategoryCatalog> => {
    const response = await api.get<CategoryCatalog>('/api/categories/catalog', {
      signal,
      params: sessionId ? { sessionId } : undefined,
    });
    return response.data;
  },

  /**
   * Month-by-month comparison of expenses by category, with each cell's share
   * of that month's total expenses (and month-over-month deltas).
   */
  getCategoryMonthlyComparison: async (
    sessionId: string,
    dateType?: string,
    signal?: AbortSignal,
  ): Promise<CategoryMonthlyComparisonData> => {
    const response = await api.get<CategoryMonthlyComparisonData>('/api/charts/v2/category-monthly-comparison', {
      params: { sessionId, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },

  renameCategory: async (
    sessionId: string,
    oldCategory: string,
    newCategory: string,
  ): Promise<{ success: boolean; old_category: string; new_category: string; affected_count: number; merchants: string[] }> => {
    const response = await api.post<{ success: boolean; old_category: string; new_category: string; affected_count: number; merchants: string[] }>(
      '/api/categories/rename',
      {
        session_id: sessionId,
        old_category: oldCategory,
        new_category: newCategory,
      },
    );
    return response.data;
  },

  /**
   * Get metrics
   */
  getMetrics: async (sessionId: string, signal?: AbortSignal): Promise<MetricsData> => {
    const response = await api.get<MetricsData>('/api/metrics', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get categories list
   */
  getCategories: async (sessionId: string, signal?: AbortSignal): Promise<string[]> => {
    const response = await api.get<string[]>('/api/categories', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get detailed session metadata (columns, date ranges, categories, etc.)
   */
  getSessionInfo: async (sessionId: string, signal?: AbortSignal): Promise<SessionInfo> => {
    const response = await api.get<SessionInfo>('/api/session-info', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get donut chart data (v1 - Plotly format)
   */
  getDonutChart: async (sessionId: string, signal?: AbortSignal): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/donut', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get monthly chart data (v1 - Plotly format)
   */
  getMonthlyChart: async (sessionId: string, signal?: AbortSignal): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/monthly', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get weekday chart data (v1 - Plotly format)
   */
  getWeekdayChart: async (sessionId: string, signal?: AbortSignal): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/weekday', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get trend chart data (v1 - Plotly format)
   */
  getTrendChart: async (sessionId: string, signal?: AbortSignal): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/trend', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get merchants chart data (v1 - Plotly format)
   */
  getMerchantsChart: async (sessionId: string, n: number = 8, signal?: AbortSignal): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/merchants', {
      params: { sessionId, n },
      signal,
    });
    return response.data;
  },

  /**
   * Export transactions to Excel
   */
  exportTransactions: async (
    sessionId: string,
    filters?: { start_date?: string; end_date?: string; category?: string },
    signal?: AbortSignal
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('sessionId', sessionId);

    if (filters) {
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.category) params.append('category', filters.category);
    }

    const response = await api.get(`/api/export?${params.toString()}`, {
      responseType: 'blob',
      signal,
    });

    return response.data;
  },

  // ─── V2 Chart Endpoints (raw format for Recharts) ─────────────────

  /**
   * Get donut chart data (v2 - raw Recharts format)
   */
  getDonutChartV2: async (sessionId: string, signal?: AbortSignal): Promise<RawDonutData> => {
    const response = await api.get<RawDonutData>('/api/charts/v2/donut', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Income broken down by source (where it came from). Respects the scoped
   * session, so it follows the per-person filter.
   */
  getIncomeSources: async (sessionId: string, signal?: AbortSignal): Promise<IncomeSourcesData> => {
    const response = await api.get<IncomeSourcesData>('/api/charts/v2/income-sources', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get monthly chart data (v2 - raw Recharts format)
   */
  getMonthlyChartV2: async (sessionId: string, dateType?: string, signal?: AbortSignal): Promise<RawMonthlyData> => {
    const response = await api.get<RawMonthlyData>('/api/charts/v2/monthly', {
      params: { sessionId, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get weekday chart data (v2 - raw Recharts format)
   */
  getWeekdayChartV2: async (sessionId: string, signal?: AbortSignal): Promise<RawWeekdayData> => {
    const response = await api.get<RawWeekdayData>('/api/charts/v2/weekday', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get trend chart data (v2 - raw Recharts format)
   */
  getTrendChartV2: async (sessionId: string, signal?: AbortSignal): Promise<RawTrendData> => {
    const response = await api.get<RawTrendData>('/api/charts/v2/trend', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  // ─── Insights & Analytics ─────────────────────────────────────────

  /**
   * Get transaction insights (biggest expense, top merchant, etc.)
   */
  getInsights: async (sessionId: string, signal?: AbortSignal): Promise<InsightData> => {
    const response = await api.get<InsightData>('/api/insights', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get top merchants with aggregated stats
   */
  getMerchants: async (sessionId: string, n?: number, signal?: AbortSignal): Promise<MerchantData> => {
    const response = await api.get<MerchantData>('/api/merchants', {
      params: { sessionId, ...(n !== undefined && { n }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get trend statistics (max expense, daily avg, median, monthly changes)
   */
  getTrendStats: async (sessionId: string, signal?: AbortSignal): Promise<TrendStats> => {
    const response = await api.get<TrendStats>('/api/trend-stats', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get heatmap data (categories x months matrix)
   */
  getHeatmap: async (sessionId: string, signal?: AbortSignal): Promise<HeatmapData> => {
    const response = await api.get<HeatmapData>('/api/charts/v2/heatmap', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },
  // ─── Premium Analytics ───────────────────────────────────────────

  /**
   * Get recurring/subscription transactions
   */
  getRecurring: async (sessionId: string, signal?: AbortSignal): Promise<RecurringData> => {
    const response = await api.get<RecurringData>('/api/analytics/recurring', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get spending forecast for next month
   */
  getForecast: async (sessionId: string, signal?: AbortSignal): Promise<ForecastData> => {
    const response = await api.get<ForecastData>('/api/analytics/forecast', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get weekly summary (this week vs last week)
   */
  getWeeklySummary: async (sessionId: string, signal?: AbortSignal): Promise<WeeklySummaryData> => {
    const response = await api.get<WeeklySummaryData>('/api/analytics/weekly-summary', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get spending velocity (daily rates + rolling averages)
   */
  getSpendingVelocity: async (sessionId: string, signal?: AbortSignal): Promise<SpendingVelocityData> => {
    const response = await api.get<SpendingVelocityData>('/api/analytics/spending-velocity', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Get anomaly detection (transactions > 2σ from category mean)
   */
  getAnomalies: async (sessionId: string, signal?: AbortSignal): Promise<AnomalyData> => {
    const response = await api.get<AnomalyData>('/api/analytics/anomalies', {
      params: { sessionId },
      signal,
    });
    return response.data;
  },

  /**
   * Search transactions
   */
  searchTransactions: async (sessionId: string, query: string, limit?: number, signal?: AbortSignal): Promise<SearchResult> => {
    const response = await api.get<SearchResult>('/api/search', {
      params: { sessionId, q: query, ...(limit !== undefined && { limit }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get income vs expenses breakdown by category for a specific month
   */
  getMonthOverview: async (sessionId: string, month: string, dateType?: string, signal?: AbortSignal): Promise<MonthOverviewData> => {
    const response = await api.get<MonthOverviewData>('/api/charts/v2/month-overview', {
      params: { sessionId, month, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get expenses per category per month for stacked bar chart comparison
   */
  getIndustryMonthly: async (sessionId: string, dateType?: string, signal?: AbortSignal): Promise<IndustryMonthlyData> => {
    const response = await api.get<IndustryMonthlyData>('/api/charts/v2/industry-monthly', {
      params: { sessionId, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get full category snapshot (all categories with count + total).
   * Optional month range filter (MM/YYYY format).
   */
  getCategorySnapshot: async (sessionId: string, signal?: AbortSignal, monthFrom?: string, monthTo?: string, dateType?: string): Promise<CategorySnapshotData> => {
    const params: Record<string, string> = { sessionId }
    if (monthFrom) params.month_from = monthFrom
    if (monthTo) params.month_to = monthTo
    if (dateType) params.date_type = dateType
    const response = await api.get<CategorySnapshotData>('/api/charts/v2/category-snapshot', {
      params,
      signal,
    });
    return response.data;
  },

  /**
   * Get transactions for a category, optionally filtered by month or date range (drill-down)
   */
  getCategoryTransactions: async (
    sessionId: string,
    month: string,
    category: string,
    dateType?: string,
    sortOrder?: string,
    signal?: AbortSignal,
    monthFrom?: string,
    monthTo?: string,
  ): Promise<CategoryTransactionsData> => {
    const response = await api.get<CategoryTransactionsData>('/api/charts/v2/category-transactions', {
      params: {
        sessionId,
        category,
        ...(month && { month }),
        ...(monthFrom && { month_from: monthFrom }),
        ...(monthTo && { month_to: monthTo }),
        ...(dateType && { date_type: dateType }),
        ...(sortOrder && { sort_order: sortOrder }),
      },
      signal,
    });
    return response.data;
  },

  /**
   * Get merchant breakdown within a category for a month (drill-down)
   */
  getCategoryMerchants: async (
    sessionId: string,
    month: string,
    category: string,
    dateType?: string,
    signal?: AbortSignal,
  ): Promise<CategoryMerchantsData> => {
    const response = await api.get<CategoryMerchantsData>('/api/charts/v2/category-merchants', {
      params: { sessionId, month, category, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },

  /**
   * Get transactions for a specific merchant within a category/month (drill-down)
   */
  getMerchantTransactions: async (
    sessionId: string,
    month: string,
    category: string,
    merchant: string,
    dateType?: string,
    signal?: AbortSignal,
  ): Promise<CategoryTransactionsData> => {
    const response = await api.get<CategoryTransactionsData>('/api/charts/v2/merchant-transactions', {
      params: { sessionId, month, category, merchant, ...(dateType && { date_type: dateType }) },
      signal,
    });
    return response.data;
  },
};

export default api;
