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
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const transactionsApi = {
  /**
   * Upload transaction file
   */
  uploadFile: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<FileUploadResponse>('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Get transactions with filters
   */
  getTransactions: async (
    sessionId: string,
    filters?: TransactionFilters
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
    
    const response = await api.get<TransactionResponse>(`/api/transactions?${params.toString()}`);
    return response.data;
  },

  /**
   * Get metrics
   */
  getMetrics: async (sessionId: string): Promise<MetricsData> => {
    const response = await api.get<MetricsData>('/api/metrics', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get categories list
   */
  getCategories: async (sessionId: string): Promise<string[]> => {
    const response = await api.get<string[]>('/api/categories', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get donut chart data
   */
  getDonutChart: async (sessionId: string): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/donut', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get monthly chart data
   */
  getMonthlyChart: async (sessionId: string): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/monthly', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get weekday chart data
   */
  getWeekdayChart: async (sessionId: string): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/weekday', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get trend chart data
   */
  getTrendChart: async (sessionId: string): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/trend', {
      params: { sessionId: sessionId },
    });
    return response.data;
  },

  /**
   * Get merchants chart data
   */
  getMerchantsChart: async (sessionId: string, n: number = 8): Promise<ChartData> => {
    const response = await api.get<ChartData>('/api/charts/merchants', {
      params: { sessionId: sessionId, n },
    });
    return response.data;
  },

  /**
   * Export transactions to Excel
   */
  exportTransactions: async (
    sessionId: string,
    filters?: { start_date?: string; end_date?: string; category?: string }
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
    });
    
    return response.data;
  },
};

export default api;
