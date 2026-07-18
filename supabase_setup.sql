-- =============================================================================
-- Supabase Database Setup for מנתח עסקאות
-- =============================================================================
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
-- =============================================================================

-- 1. Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Saved incomes table
CREATE TABLE IF NOT EXISTS public.incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    income_type TEXT NOT NULL DEFAULT 'אחר',
    recurring TEXT NOT NULL DEFAULT 'חד-פעמי',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own incomes" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incomes" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own incomes" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

-- 3. Uploaded file history
CREATE TABLE IF NOT EXISTS public.upload_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    row_count INTEGER,
    total_expenses NUMERIC,
    total_income NUMERIC,
    date_range_start DATE,
    date_range_end DATE,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own uploads" ON public.upload_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.upload_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Saved transactions (persistent data)
CREATE TABLE IF NOT EXISTS public.saved_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.saved_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.saved_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.saved_transactions FOR DELETE USING (auth.uid() = user_id);

-- 5. User settings / preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    theme TEXT DEFAULT 'dark',
    default_currency TEXT DEFAULT 'ILS',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- 6. User-defined category overrides (learning from manual edits)
-- When the dashboard misclassifies a transaction, the user can reassign
-- it. We store the merchant→category (and optional subcategory) mapping so
-- every future upload with the same merchant string lands in the corrected
-- category/subcategory.
CREATE TABLE IF NOT EXISTS public.user_category_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    merchant TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, merchant)
);

-- Migration for existing deployments: add the subcategory column if missing.
-- Safe to re-run. REQUIRED before deploying the subcategory feature (the
-- dashboard selects this column when loading rules).
ALTER TABLE public.user_category_rules ADD COLUMN IF NOT EXISTS subcategory TEXT;

ALTER TABLE public.user_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own category rules" ON public.user_category_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own category rules" ON public.user_category_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own category rules" ON public.user_category_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own category rules" ON public.user_category_rules FOR DELETE USING (auth.uid() = user_id);

-- 7. Single-transaction category pins ("אל תשנה סיווג של עסקאות דומות")
-- Unlike user_category_rules (merchant-wide), each row here pins EXACTLY ONE
-- transaction — matched by a stable fingerprint (date|amount|description,
-- computed server-side) — to a category/subcategory. Lets e.g. every ביט
-- transfer carry a different category. Highest precedence in the pipeline.
-- This whole section is idempotent — safe to re-run.
CREATE TABLE IF NOT EXISTS public.transaction_overrides (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    txn_key TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, txn_key)
);

ALTER TABLE public.transaction_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own txn overrides" ON public.transaction_overrides;
DROP POLICY IF EXISTS "Users can insert own txn overrides" ON public.transaction_overrides;
DROP POLICY IF EXISTS "Users can update own txn overrides" ON public.transaction_overrides;
DROP POLICY IF EXISTS "Users can delete own txn overrides" ON public.transaction_overrides;
CREATE POLICY "Users can view own txn overrides" ON public.transaction_overrides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own txn overrides" ON public.transaction_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own txn overrides" ON public.transaction_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own txn overrides" ON public.transaction_overrides FOR DELETE USING (auth.uid() = user_id);

-- 8. User-created categories (the dynamic taxonomy)
-- Categories the user adds beyond the built-in tree (typed into the category
-- editor). Loaded at login and passed to /restore-session so restores treat
-- them as valid instead of resetting their rows to שונות.
-- This whole section is idempotent — safe to re-run.
CREATE TABLE IF NOT EXISTS public.user_categories (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, name)
);

ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.user_categories;
CREATE POLICY "Users can view own categories" ON public.user_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.user_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.user_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.user_categories FOR DELETE USING (auth.uid() = user_id);

-- 9. Per-transaction notes (הערות)
-- Free-text note on ONE transaction, keyed by the same stable fingerprint as
-- transaction_overrides. Re-applied on every /restore-session so notes
-- survive backend cold starts. This whole section is idempotent.
CREATE TABLE IF NOT EXISTS public.transaction_notes (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    txn_key TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, txn_key)
);

ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own txn notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can insert own txn notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can update own txn notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can delete own txn notes" ON public.transaction_notes;
CREATE POLICY "Users can view own txn notes" ON public.transaction_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own txn notes" ON public.transaction_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own txn notes" ON public.transaction_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own txn notes" ON public.transaction_notes FOR DELETE USING (auth.uid() = user_id);
