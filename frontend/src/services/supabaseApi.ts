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
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return null;

    // New format: single row whose data is already a full array
    if (Array.isArray(data[0].data)) {
      return data[0].data as unknown[];
    }

    // Old format: one row per transaction, data may be a JSON string or plain object
    const transactions = data.map(row => {
      const d = row.data;
      if (typeof d === 'string') {
        try { return JSON.parse(d); } catch { return null; }
      }
      return d;
    }).filter(Boolean);

    return transactions.length > 0 ? transactions : null;
  },

  // ─── Category Rules (user-edited categories) ──────────────────────────

  /**
   * Load every merchant→category override the user has saved. Applied
   * server-side on /restore-session so they win over the keyword/AI
   * categorizer.
   */
  getCategoryRules: async (
    userId: string,
  ): Promise<{ merchant: string; category: string; subcategory?: string | null }[]> => {
    const { data, error } = await supabase
      .from('user_category_rules')
      .select('merchant, category, subcategory')
      .eq('user_id', userId);
    if (error) {
      // The `subcategory` column may be missing on a deployment that hasn't run
      // the migration yet. Retry without it so we never silently drop ALL rules.
      const { data: legacy, error: legacyErr } = await supabase
        .from('user_category_rules')
        .select('merchant, category')
        .eq('user_id', userId);
      if (legacyErr) {
        // Table may not exist yet on older deployments — degrade gracefully.
        // eslint-disable-next-line no-console
        console.warn('getCategoryRules failed:', legacyErr.message);
        return [];
      }
      return legacy || [];
    }
    return data || [];
  },

  /**
   * Upsert one rule. Called when the user manually changes a transaction's
   * category in the dashboard.
   */
  upsertCategoryRule: async (
    userId: string,
    merchant: string,
    category: string,
  ): Promise<void> => {
    const { error } = await supabase
      .from('user_category_rules')
      .upsert(
        { user_id: userId, merchant, category, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,merchant' },
      );
    if (error) throw error;
  },

  upsertCategoryRules: async (
    userId: string,
    rules: { merchant: string; category: string }[],
  ): Promise<void> => {
    const rows = rules
      .filter((r) => r.merchant && r.category)
      .map((r) => ({
        user_id: userId,
        merchant: r.merchant,
        category: r.category,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('user_category_rules')
      .upsert(rows, { onConflict: 'user_id,merchant' });
    if (error) throw error;
  },

  /**
   * Upsert a merchant→{category, subcategory} rule. Separate from
   * upsertCategoryRule (which never touches `subcategory`) so a category-only
   * edit can't clobber an existing subcategory, and vice-versa. We send the
   * category alongside because the table's `category` column is NOT NULL.
   */
  upsertCategorySubrule: async (
    userId: string,
    merchant: string,
    category: string,
    subcategory: string,
  ): Promise<void> => {
    if (!merchant || !category) return;
    const { error } = await supabase
      .from('user_category_rules')
      .upsert(
        {
          user_id: userId,
          merchant,
          category,
          subcategory: subcategory || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,merchant' },
      );
    if (error) throw error;
  },

  deleteCategoryRule: async (userId: string, merchant: string): Promise<void> => {
    const { error } = await supabase
      .from('user_category_rules')
      .delete()
      .eq('user_id', userId)
      .eq('merchant', merchant);
    if (error) throw error;
  },

  /**
   * Delete several rules at once. Used by the login-time hygiene pass to purge
   * junk rules (e.g. category 'אחר' persisted by early AI runs) so they stop
   * overriding the real categorizer everywhere — including bank-sync.
   */
  deleteCategoryRules: async (userId: string, merchants: string[]): Promise<void> => {
    if (!merchants.length) return;
    const { error } = await supabase
      .from('user_category_rules')
      .delete()
      .eq('user_id', userId)
      .in('merchant', merchants);
    if (error) throw error;
  },

  // ─── Single-Transaction Overrides ("אל תשנה עסקאות דומות") ────────────

  /**
   * Load every single-transaction pin. Passed to /restore-session where they
   * are applied LAST — beating the catalog, merchant rules and the AI — so a
   * transaction pinned to a category stays there forever, alone.
   */
  getTransactionOverrides: async (
    userId: string,
  ): Promise<{ txn_key: string; category: string; subcategory?: string | null }[]> => {
    const { data, error } = await supabase
      .from('transaction_overrides')
      .select('txn_key, category, subcategory')
      .eq('user_id', userId);
    if (error) {
      // Table may not exist yet (migration not run) — degrade gracefully.
      // eslint-disable-next-line no-console
      console.warn('getTransactionOverrides failed:', error.message);
      return [];
    }
    return data || [];
  },

  upsertTransactionOverride: async (
    userId: string,
    txnKey: string,
    category: string,
    subcategory: string | null,
  ): Promise<void> => {
    if (!txnKey || !category) return;
    const { error } = await supabase
      .from('transaction_overrides')
      .upsert(
        {
          user_id: userId,
          txn_key: txnKey,
          category,
          subcategory: subcategory || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,txn_key' },
      );
    if (error) throw error;
  },

  deleteTransactionOverride: async (userId: string, txnKey: string): Promise<void> => {
    if (!txnKey) return;
    const { error } = await supabase
      .from('transaction_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('txn_key', txnKey);
    if (error) throw error;
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
