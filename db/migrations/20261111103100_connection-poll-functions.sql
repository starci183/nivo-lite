-- The two writes of the poll schedule that start from `public.connections`, which the poll capability does not own: put every connection of some
-- providers into the schedule, and make one connection hot. Each is an INSERT ... SELECT with ON CONFLICT, which an entity cannot express, so the
-- backend calls them as database functions (callDbFunction) instead of holding the statement text.

-- Gives every connection of the providers that has no row a row, spread at random over the interval so tenants never poll in step; answers how many
-- rows it added.
CREATE FUNCTION public.connection_poll_enroll(p_providers text[], p_interval_ms integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  enrolled integer;
BEGIN
  INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms)
    SELECT c.id, c.workspace_id, c.provider, now() + make_interval(secs => random() * p_interval_ms::double precision / 1000), p_interval_ms
      FROM public.connections c
     WHERE c.provider = ANY(p_providers) AND c.status <> 'disconnected'
    ON CONFLICT (connection_id) DO NOTHING;
  GET DIAGNOSTICS enrolled = ROW_COUNT;
  RETURN enrolled;
END;
$$;

-- Puts a connection in the schedule, hot, or makes its existing row hot and due sooner; a row that needs the owner stays parked. A connection that
-- is disconnected or missing adds nothing.
CREATE FUNCTION public.connection_poll_mark_hot(p_connection uuid, p_interval_ms integer, p_ttl_ms double precision, p_reason text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms, hot_until, hot_reason)
    SELECT c.id, c.workspace_id, c.provider, now(), p_interval_ms, now() + make_interval(secs => p_ttl_ms / 1000), p_reason
      FROM public.connections c
     WHERE c.id = p_connection AND c.status <> 'disconnected'
    ON CONFLICT (connection_id) DO UPDATE SET
      hot_until = GREATEST(connection_poll_schedule.hot_until, EXCLUDED.hot_until),
      hot_reason = EXCLUDED.hot_reason,
      next_poll_at = CASE
        WHEN connection_poll_schedule.needs_reauth THEN connection_poll_schedule.next_poll_at
        ELSE LEAST(connection_poll_schedule.next_poll_at, now() + make_interval(secs => p_interval_ms::double precision / 1000))
      END;
$$;

REVOKE ALL ON FUNCTION public.connection_poll_enroll(text[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connection_poll_mark_hot(uuid, integer, double precision, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connection_poll_enroll(text[], integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.connection_poll_mark_hot(uuid, integer, double precision, text) TO app_be;
