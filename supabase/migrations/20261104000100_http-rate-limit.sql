-- v0.3.5: every API and MCP replica counts the same fixed windows, using PostgreSQL time.
CREATE TABLE public.http_security (
    bucket_key text NOT NULL,
    hits bigint NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    CONSTRAINT http_security_pkey PRIMARY KEY (bucket_key),
    CONSTRAINT http_security_hits_check CHECK (hits > 0)
);

CREATE INDEX http_security_expiry_idx ON public.http_security (reset_at);
ALTER TABLE public.http_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY http_security_app_be_select ON public.http_security
    FOR SELECT TO app_be USING (bucket_key <> '');
CREATE POLICY http_security_app_be_insert ON public.http_security
    FOR INSERT TO app_be WITH CHECK (bucket_key <> '');
CREATE POLICY http_security_app_be_update ON public.http_security
    FOR UPDATE TO app_be USING (bucket_key <> '') WITH CHECK (bucket_key <> '');
CREATE POLICY http_security_app_be_delete ON public.http_security
    FOR DELETE TO app_be USING (bucket_key <> '');
REVOKE ALL ON TABLE public.http_security FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.http_security TO app_be;

-- Every consumption reclaims at most 100 idle expired windows without waiting behind another replica's increment.
CREATE FUNCTION public.http_rate_limit_cleanup() RETURNS integer
    LANGUAGE sql
    SET search_path = ''
    AS $$
        WITH expired AS (
            SELECT bucket_key FROM public.http_security
            WHERE reset_at <= statement_timestamp()
            ORDER BY reset_at
            LIMIT 100
            FOR UPDATE SKIP LOCKED
        ), removed AS (
            DELETE FROM public.http_security AS bucket
            USING expired WHERE bucket.bucket_key = expired.bucket_key
            RETURNING 1
        )
        SELECT count(*)::integer FROM removed;
    $$;
REVOKE EXECUTE ON FUNCTION public.http_rate_limit_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.http_rate_limit_cleanup() TO app_be;

-- The unique key serializes increments and rollover, and database time keeps all replicas on the same clock.
CREATE FUNCTION public.http_rate_limit_consume(p_bucket_key text, p_window_ms double precision, p_limit bigint)
    RETURNS boolean
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
    DECLARE
        allowed boolean;
    BEGIN
        INSERT INTO public.http_security AS bucket (bucket_key, hits, reset_at)
        VALUES (p_bucket_key, 1, statement_timestamp() + p_window_ms * interval '1 millisecond')
        ON CONFLICT (bucket_key) DO UPDATE SET
            hits = CASE WHEN bucket.reset_at <= statement_timestamp() THEN 1 ELSE bucket.hits + 1 END,
            reset_at = CASE WHEN bucket.reset_at <= statement_timestamp()
                THEN statement_timestamp() + p_window_ms * interval '1 millisecond' ELSE bucket.reset_at END
        RETURNING hits <= p_limit INTO allowed;
        PERFORM public.http_rate_limit_cleanup();
        RETURN allowed;
    END;
    $$;
REVOKE EXECUTE ON FUNCTION public.http_rate_limit_consume(text, double precision, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.http_rate_limit_consume(text, double precision, bigint) TO app_be;
