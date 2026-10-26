-- Additive pending storage. Apply only after explicit production approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'pending_migration_requires_privileged_owner';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS pinkas_private;
REVOKE ALL ON SCHEMA pinkas_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA pinkas_private TO authenticated;

CREATE TABLE public.pending_card_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_key text NOT NULL CHECK (length(card_key) BETWEEN 1 AND 512),
  version bigint NOT NULL CHECK (version BETWEEN 1 AND 9007199254740991),
  data jsonb NOT NULL,
  PRIMARY KEY (user_id, card_key),
  CHECK (jsonb_typeof(data) = 'object'),
  CHECK (octet_length(data::text) <= 262144)
);
ALTER TABLE public.pending_card_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_card_snapshots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_card_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pending_card_snapshots TO authenticated;
CREATE POLICY pending_owner_select ON public.pending_card_snapshots
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION pinkas_private.pending_snapshot_valid(p jsonb, p_card_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE s jsonb; r jsonb; identity_parts jsonb; keys text[];
BEGIN
  IF p_card_key IS NULL OR p_card_key !~ '^\["isracard","pending-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}","(11|77)",(true|false),"[0-9]{4}"\]$' THEN RETURN false; END IF;
  IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>262144 THEN RETURN false; END IF;
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(p) k;
  IF keys IS NULL OR (keys<>ARRAY['checkedAt','current','state','unresolved'] AND keys<>ARRAY['checkedAt','current','error','state','unresolved']) THEN RETURN false; END IF;
  IF p->>'state' IS NULL OR p->>'state' NOT IN ('current','stale','unknown','rollover_review','retention_limit') THEN RETURN false; END IF;
  IF jsonb_typeof(p->'checkedAt') IS DISTINCT FROM 'string' OR p->>'checkedAt' !~ '^\d{4}-\d{2}-\d{2}T' THEN RETURN false; END IF;
  PERFORM (p->>'checkedAt')::timestamptz;
  IF p->'current'='null'::jsonb AND p->>'state'<>'unknown' THEN RETURN false; END IF;
  IF p ? 'error' AND COALESCE(p->>'error','') NOT IN (
    'pending_discovery_unavailable','pending_transport_unavailable','pending_contract_unsupported',
    'pending_rate_limited','pending_auth_required','pending_timeout','pending_outer_timeout',
    'pending_response_limit','pending_session_failed','pending_session_unavailable',
    'pending_not_observed','pending_review_backlog_full') THEN RETURN false; END IF;
  IF jsonb_typeof(p->'unresolved') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'unresolved')>12 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'unresolved') x GROUP BY x->>'scope' HAVING count(*)>1) THEN RETURN false; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements((p->'unresolved') || CASE WHEN p->'current'='null'::jsonb THEN '[]'::jsonb ELSE jsonb_build_array(p->'current') END) LOOP
    IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(s) k;
    IF keys IS NULL OR keys<>ARRAY['cardKey','observedAt','rows','scope','success'] OR s->>'cardKey' IS DISTINCT FROM p_card_key OR s->'success' IS DISTINCT FROM 'true'::jsonb THEN RETURN false; END IF;
    IF jsonb_typeof(s->'scope') IS DISTINCT FROM 'string' OR left(s->>'scope',length(p_card_key)+1)<>p_card_key||'|' OR substring(s->>'scope' FROM length(p_card_key)+2) !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RETURN false; END IF;
    IF jsonb_typeof(s->'observedAt') IS DISTINCT FROM 'string' OR s->>'observedAt' !~ '^\d{4}-\d{2}-\d{2}T' THEN RETURN false; END IF;
    PERFORM (s->>'observedAt')::timestamptz;
    IF jsonb_typeof(s->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'rows')>1000 THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(s->'rows') x GROUP BY x->>'identity' HAVING count(*)>1) THEN RETURN false; END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(s->'rows') LOOP
      IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
      SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(r) k;
      IF keys IS NULL OR keys<>ARRAY['authorizationMinor','currency','date','identity','merchant','status'] THEN RETURN false; END IF;
      IF r->>'currency' IS DISTINCT FROM 'ILS' OR r->>'status' IS DISTINCT FROM 'pending' THEN RETURN false; END IF;
      IF jsonb_typeof(r->'merchant') IS DISTINCT FROM 'string' OR length(btrim(r->>'merchant')) NOT BETWEEN 1 AND 500 OR r->>'merchant' ~ '[[:cntrl:]]' THEN RETURN false; END IF;
      IF jsonb_typeof(r->'identity') IS DISTINCT FROM 'string' OR length(r->>'identity') NOT BETWEEN 1 AND 2048 THEN RETURN false; END IF;
      identity_parts := (r->>'identity')::jsonb;
      IF jsonb_typeof(identity_parts) IS DISTINCT FROM 'array' OR jsonb_array_length(identity_parts)<>4 OR identity_parts->>0 IS DISTINCT FROM s->>'scope' THEN RETURN false; END IF;
      IF jsonb_typeof(identity_parts->1) IS DISTINCT FROM 'number' OR identity_parts->>1 !~ '^\d+$' OR (identity_parts->>1)::numeric>9007199254740991 THEN RETURN false; END IF;
      IF jsonb_typeof(identity_parts->2) IS DISTINCT FROM 'string' OR length(btrim(identity_parts->>2))=0 OR jsonb_typeof(identity_parts->3) IS DISTINCT FROM 'string' OR length(btrim(identity_parts->>3))=0 THEN RETURN false; END IF;
      IF jsonb_typeof(r->'date') IS DISTINCT FROM 'string' OR r->>'date' !~ '^\d{4}-\d{2}-\d{2}$' OR to_char((r->>'date')::date,'YYYY-MM-DD')<>r->>'date' THEN RETURN false; END IF;
      IF jsonb_typeof(r->'authorizationMinor') IS DISTINCT FROM 'number' OR r->>'authorizationMinor' !~ '^-?\d+$' OR abs((r->>'authorizationMinor')::numeric)>9007199254740991 THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION pinkas_private.pending_snapshot_valid(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION pinkas_private.write_pending_card_snapshot(p_card_key text,p_expected_version bigint,p_data jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid:=auth.uid(); existing_version bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'pending_auth_required' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version<0 OR p_expected_version>=9007199254740991 OR NOT pinkas_private.pending_snapshot_valid(p_data,p_card_key) THEN
    RAISE EXCEPTION 'pending_invalid' USING ERRCODE='22023';
  END IF;
  -- Same lock order as account deletion: auth user before any pending row.
  -- Reject still-valid JWTs after their auth user was deleted.
  PERFORM 1 FROM auth.users WHERE id=uid FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending_auth_required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
  SELECT version INTO existing_version FROM public.pending_card_snapshots WHERE user_id=uid AND card_key=p_card_key FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'pending_conflict' USING ERRCODE='P0002'; END IF;
    IF (SELECT count(*) FROM public.pending_card_snapshots WHERE user_id=uid)>=20 THEN RAISE EXCEPTION 'pending_card_limit' USING ERRCODE='54000'; END IF;
    INSERT INTO public.pending_card_snapshots(user_id,card_key,version,data) VALUES(uid,p_card_key,1,p_data);
    RETURN 1;
  END IF;
  IF existing_version<>p_expected_version THEN RAISE EXCEPTION 'pending_conflict' USING ERRCODE='P0002'; END IF;
  UPDATE public.pending_card_snapshots SET version=existing_version+1,data=p_data WHERE user_id=uid AND card_key=p_card_key;
  RETURN existing_version+1;
END $$;
REVOKE ALL ON FUNCTION pinkas_private.write_pending_card_snapshot(text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION pinkas_private.write_pending_card_snapshot(text,bigint,jsonb) TO authenticated;

CREATE FUNCTION public.write_pending_card_snapshot(p_card_key text,p_expected_version bigint,p_data jsonb)
RETURNS bigint LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT pinkas_private.write_pending_card_snapshot(p_card_key,p_expected_version,p_data);
$$;
REVOKE ALL ON FUNCTION public.write_pending_card_snapshot(text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.write_pending_card_snapshot(text,bigint,jsonb) TO authenticated;
-- Existing account deletion remains untouched. The FK cascades pending rows.
NOTIFY pgrst, 'reload schema';
COMMIT;
