/**
 * TypeScript types for the transactions dashboard
 */

export interface Transaction {
  תאריך: string;
  תיאור: string;
  קטגוריה: string;
  סכום: number;
  סכום_מוחלט?: number;
  חודש?: string;
  יום_בשבוע?: number;
  תאריך_חיוב?: string;
  חודש_חיוב?: string;
}

export interface TransactionResponse {
  transactions: Transaction[];
  total: number;
  page?: number;
  page_size?: number;
}

export interface MetricsData {
  total_transactions: number;
  total_expenses: number;
  total_income: number;
  average_transaction: number;
  trend?: 'up' | 'down' | null;
  has_billing_date?: boolean;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  session_id?: string;
  sheets?: string[];
  transaction_count?: number;
}

export interface ChartData {
  data: Array<{
    labels?: string[];
    values?: number[];
    x?: string[];
    y?: number[];
  }>;
  layout: Record<string, any>;
}

export interface CategoryData {
  קטגוריה: string;
  סכום_מוחלט: number;
  אחוז?: number;
}

export interface DonutChartData {
  categories: CategoryData[];
  total: number;
}

export interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  category?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// V2 Chart Data (raw format for Recharts)
export interface RawDonutData {
  categories: { name: string; value: number }[];
  total: number;
}

export interface RawMonthlyData {
  months: { month: string; amount: number }[];
}

export interface RawWeekdayData {
  days: { day: string; amount: number }[];
}

export interface RawTrendData {
  points: { date: string; balance: number }[];
}

// Insights
export interface InsightData {
  biggest_expense: {
    description: string;
    amount: number;
    date: string;
    category: string;
  };
  top_merchant: {
    name: string;
    count: number;
    total: number;
  };
  expensive_day: {
    day: string;
    average: number;
  };
  avg_transaction: number;
  large_transactions: Transaction[];
}

// Merchants
export interface MerchantData {
  merchants: {
    name: string;
    total: number;
    count: number;
    average: number;
  }[];
}

// Trend Statistics
export interface TrendStats {
  max_expense: number;
  daily_avg: number;
  median: number;
  transaction_count: number;
  monthly: {
    month: string;
    amount: number;
    change_pct: number | null;
  }[];
}

// Heatmap
export interface HeatmapData {
  categories: string[];
  months: string[];
  data: number[][];
}

// Income Management
export interface Income {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  income_type: string;
  recurring: string;
  created_at: string;
}

export interface BudgetSummary {
  total_income: number;
  total_expenses: number;
  balance: number;
  utilization: number; // percentage 0-100
}

export interface UploadHistory {
  id: string;
  file_name: string;
  row_count: number;
  total_expenses: number;
  total_income: number;
  uploaded_at: string;
}

// ─── Analytics (Premium) ──────────────────────────────────────────

export interface RecurringTransaction {
  merchant: string;
  average_amount: number;
  frequency: string;
  count: number;
  next_expected: string;
  total: number;
  interval_days: number;
}

export interface RecurringData {
  recurring: RecurringTransaction[];
}

export interface ForecastData {
  forecast_amount: number;
  confidence: 'low' | 'medium' | 'high';
  trend_direction: 'up' | 'down' | 'stable';
  monthly_data: { month: string; amount: number }[];
  avg_monthly: number;
}

export interface WeeklySummaryData {
  this_week: { total: number; count: number; top_category: string };
  last_week: { total: number; count: number; top_category: string };
  change_pct: number;
}

export interface SpendingVelocityData {
  daily_avg: number;
  rolling_7day: number;
  rolling_30day: number;
  daily_data: { date: string; amount: number }[];
}

export interface AnomalyItem {
  description: string;
  amount: number;
  category: string;
  date: string;
  deviation: number;
  category_mean: number;
  category_std: number;
}

export interface AnomalyData {
  anomalies: AnomalyItem[];
}

export interface SearchResult {
  results: Transaction[];
  total: number;
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline?: string
  category: string
  color: string
  created_at: string
}

// Category snapshot: enriched analytical data per category
export interface CategorySnapshotItem {
  name: string
  total: number
  count: number
  percent: number
  avg_transaction: number
  monthly_avg: number
  months_active: number
  month_change: number
  top_merchant: string | null
  top_merchant_total: number
  sparkline: number[]
}

export interface CategorySnapshotData {
  categories: CategorySnapshotItem[]
  total: number
  total_count: number
  month_count: number
  last_month: string | null
  prev_month: string | null
}

// Month overview: income vs expenses by category for a specific month
export interface MonthOverviewCategory {
  name: string
  expenses: number
  income: number
}

export interface MonthOverviewData {
  month: string
  categories: MonthOverviewCategory[]
  total_expenses: number
  total_income: number
  transaction_count: number
}

// Drill-down: category transactions
export interface CategoryTransactionsData {
  transactions: Transaction[]
  total: number
  count: number
}

// Drill-down: merchant breakdown within a category
export interface CategoryMerchantItem {
  name: string
  total: number
  count: number
}

export interface CategoryMerchantsData {
  merchants: CategoryMerchantItem[]
  total: number
}

// Industry monthly: expenses per category per month for comparison
export interface IndustryMonthlySeries {
  name: string
  data: number[]
}

export interface IndustryMonthlyData {
  months: string[]
  series: IndustryMonthlySeries[]
}
