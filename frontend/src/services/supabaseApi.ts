import { supabase } from '../lib/supabase';
import type { Income } from './types';

export const supabaseApi = {
  // ─── Incomes ──────────────────────────────────────────────────────────

  getIncomes: async (userId: string): Promise<Income[]> => {
    const { data, error } = await supabase
      .from('incomes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  addIncome: async (income: {
    user_id: string;
    description: string;
    amount: number;
    income_type: string;
    recurring: string;
  }): Promise<Income> => {
    const { data, error } = await supabase
      .from('incomes')
      .insert(income)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteIncome: async (id: string): Promise<void> => {
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) throw error;
  },

  deleteAllIncomes: async (userId: string): Promise<void> => {
    const { error } = await supabase.from('incomes').delete().eq('user_id', userId);
    if (error) throw error;
  },

  // ─── User Settings ────────────────────────────────────────────────────

  getUserSettings: async (userId: string) => {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data;
  },

  updateUserSettings: async (userId: string, settings: { theme?: string }) => {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...settings });
    if (error) throw error;
  },

  // ─── Transaction Persistence ──────────────────────────────────────────

  saveTransactions: async (userId: string, transactions: unknown[]): Promise<void> => {
    const { error } = await supabase
      .from('saved_transactions')
      .insert({ user_id: userId, data: transactions });
    if (error) throw error;
  },

  getLatestTransactions: async (userId: string): Promise<unknown[] | null> => {
    const { data, error } = await supabase
      .from('saved_transactions')
      .select('data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return (data?.data as unknown[]) ?? null;
  },

  // ─── Data Management ──────────────────────────────────────────────────

  deleteAllTransactions: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from('saved_transactions')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },

  getStorageInfo: async (userId: string) => {
    const [transactions, incomes, uploads] = await Promise.all([
      supabase
        .from('saved_transactions')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('incomes')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('upload_history')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false }),
    ]);
    return {
      transactionSets: transactions.count || 0,
      incomeCount: incomes.count || 0,
      uploads: uploads.data || [],
    };
  },
};
