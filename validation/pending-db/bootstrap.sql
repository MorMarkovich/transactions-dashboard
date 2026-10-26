-- Disposable fixture only. Never copy this bootstrap to a real project.
DO $$ BEGIN
  IF current_database() !~ '^pinkas_isolated(_[a-z0-9]+)?$' THEN
    RAISE EXCEPTION 'isolated_test_database_required';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'synthetic-test-only'; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
-- Exact auth.uid() definition read from project metadata, 2026-10-26.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
-- Minimal shapes needed to exercise the unchanged production deletion body.
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
CREATE TABLE public.saved_transactions(user_id uuid REFERENCES auth.users ON DELETE CASCADE,data jsonb);
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['transaction_notes','transaction_overrides','user_category_rules','user_categories','incomes','upload_history','user_settings'] LOOP
    EXECUTE format('CREATE TABLE public.%I(user_id uuid REFERENCES auth.users ON DELETE CASCADE)',name);
  END LOOP;
END $$;
-- Exact production body read from metadata, not executed in production here.
CREATE FUNCTION public.delete_my_account() RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM auth.users WHERE id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  DELETE FROM public.transaction_notes WHERE user_id=uid;
  DELETE FROM public.transaction_overrides WHERE user_id=uid;
  DELETE FROM public.user_category_rules WHERE user_id=uid;
  DELETE FROM public.user_categories WHERE user_id=uid;
  DELETE FROM public.incomes WHERE user_id=uid;
  DELETE FROM public.upload_history WHERE user_id=uid;
  DELETE FROM public.saved_transactions WHERE user_id=uid;
  DELETE FROM public.user_settings WHERE user_id=uid;
  DELETE FROM public.profiles WHERE id=uid;
  DELETE FROM auth.users WHERE id=uid;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;
