-- Function access for the back end only. Every function of the public schema that PUBLIC, anon or authenticated could still execute is closed to them (a browser holds no
-- data door, and an invoker function would only fail on table privileges); app_be keeps an explicit grant on each function the back end calls, a policy, a default or
-- another function uses (it used to reach them through PUBLIC). Trigger functions need no grant: a trigger does not check EXECUTE when it fires.

-- The knowledge queries cast to extensions.vector.
GRANT USAGE ON SCHEMA extensions TO app_be;
-- ...and the vector operators (<=>) must resolve: app_be searches "$user", public by default.
ALTER ROLE app_be SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.agent_connections_same_workspace() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automations_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.content_items_touch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.content_settings_touch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_data(uuid, pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exception_rows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exception_rows(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.governance_rows(uuid, pg_catalog.timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.governance_rows(uuid, pg_catalog.timestamptz) TO app_be;
REVOKE EXECUTE ON FUNCTION public.knowledge_chunk_visibility_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.knowledge_fold(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_fold(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.loyalty_ledger_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_knowledge(uuid, text, extensions.vector, text, pg_catalog.int4, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.module_context_versions_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.module_installations_fill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.module_type_name(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.module_type_name(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.office_data(uuid, pg_catalog.timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promo_state(uuid, pg_catalog.timestamptz, pg_catalog.timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_state(uuid, pg_catalog.timestamptz, pg_catalog.timestamptz) TO app_be;
REVOKE EXECUTE ON FUNCTION public.resolve_installation(uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.responsibility_rows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.responsibility_rows(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.session_bootstrap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shell_data(uuid, pg_catalog.timestamptz, pg_catalog.timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.video_renders_touch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.video_touch() FROM PUBLIC, anon, authenticated;

-- Future tables, sequences and functions of the public schema are not granted to the browser roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
