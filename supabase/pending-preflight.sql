-- Read-only catalog inspection; no user rows and no mutations.
SELECT current_setting('server_version') AS server_version,
       current_user AS migration_role,
       (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname=current_user) AS privileged_owner,
       to_regclass('public.pending_card_snapshots')::text AS pending_table,
       to_regprocedure('public.write_pending_card_snapshot(text,bigint,jsonb)')::text AS pending_rpc,
       to_regnamespace('pinkas_private')::text AS pending_private_schema,
       to_regprocedure('public.delete_my_account()')::text AS account_deletion;

SELECT p.proname, p.prosecdef, p.proconfig, p.proacl,
       r.rolname AS owner, r.rolbypassrls, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_roles r ON r.oid=p.proowner
WHERE (n.nspname='public' AND p.proname='delete_my_account')
   OR (n.nspname='auth' AND p.proname='uid');
