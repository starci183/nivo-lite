-- engine scope leave: lets a caller's own transaction use the entity engine and go on with its other tables. engine_scope_enter switches the
-- transaction to app_engine; this returns it to the session role and clears the workspace of the scope, both transaction-local.
CREATE FUNCTION public.engine_scope_leave() RETURNS void
    LANGUAGE sql SECURITY INVOKER
    SET search_path = ''
    AS $$
    SELECT pg_catalog.set_config('nivo.workspace_id', '', true), pg_catalog.set_config('role', session_user, true)
$$;

REVOKE EXECUTE ON FUNCTION public.engine_scope_leave() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engine_scope_leave() TO app_be;
GRANT EXECUTE ON FUNCTION public.engine_scope_leave() TO app_engine;
