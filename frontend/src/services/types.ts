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
