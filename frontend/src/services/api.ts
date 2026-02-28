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
  IndustryMonthlyData,
  CategorySnapshotData,
  CategoryTransactionsData,
  CategoryMerchantsData,
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
   * Restore a backend session from saved transaction JSON data
   */
  restoreSession: async (transactions: unknown[]): Promise<FileUploadResponse> => {
    const response = await api.post<FileUploadResponse>('/api/restore-session', {
      transactions,
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
  getCategorySnapshot: async (sessionId: string, signal?: AbortSignal, monthFrom?: string, monthTo?: string): Promise<CategorySnapshotData> => {
    const params: Record<string, string> = { sessionId }
    if (monthFrom) params.month_from = monthFrom
    if (monthTo) params.month_to = monthTo
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
