-- entity-engine-catalog: forward-only; immutable once on origin/main.
-- The read side of the entity planner (ENTITY-ENGINE-PLAN sections 2.8 and 11): public.engine_catalog() returns, as one jsonb document,
-- what `cli entities plan|check` diffs the entity declarations against: the base tables of the records model, the partitions of
-- public.records with their local constraints and own indexes, the typed views v_records_*, and the installed extensions.
-- It reads pg_catalog only and runs as the caller (SECURITY INVOKER). Shape: packages/agent-sdk/src/entity/catalog.types.ts (CatalogSnapshot).
--
-- public.engine_ts(text) is the immutable ISO-timestamp reader the generated EXCLUDE constraints and partial indexes use; the generated
-- CHECKs of a timestamptz field only let ISO text with an explicit offset through, so the value is deterministic.

CREATE FUNCTION public.engine_ts(t text) RETURNS timestamptz
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path = ''
    AS $$ SELECT t::timestamptz $$;

REVOKE EXECUTE ON FUNCTION public.engine_ts(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engine_ts(text) TO app_engine, app_be;

CREATE FUNCTION public.engine_catalog() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path = ''
    AS $$
    SELECT pg_catalog.jsonb_build_object(
        'extensions', COALESCE((SELECT pg_catalog.jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_extension e), '[]'::pg_catalog.jsonb),
        'bases', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'name', c.relname,
                'rlsEnabled', c.relrowsecurity,
                'rlsForced', c.relforcerowsecurity,
                'policies', COALESCE((
                    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'name', p.polname,
                        'roles', COALESCE((
                            SELECT pg_catalog.jsonb_agg(CASE WHEN r.oid = 0 THEN 'public' ELSE (SELECT o.rolname FROM pg_catalog.pg_roles o WHERE o.oid = r.oid)::text END)
                            FROM pg_catalog.unnest(p.polroles) AS r(oid)
                        ), '[]'::pg_catalog.jsonb),
                        'command', CASE p.polcmd WHEN 'r' THEN 'select' WHEN 'a' THEN 'insert' WHEN 'w' THEN 'update' WHEN 'd' THEN 'delete' ELSE 'all' END,
                        'permissive', p.polpermissive,
                        'qual', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
                        'check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
                    ) ORDER BY p.polname)
                    FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid
                ), '[]'::pg_catalog.jsonb),
                'grants', COALESCE((
                    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role', g.role, 'privileges', g.privileges) ORDER BY g.role)
                    FROM (
                        SELECT CASE WHEN a.grantee = 0 THEN 'public' ELSE (SELECT o.rolname FROM pg_catalog.pg_roles o WHERE o.oid = a.grantee)::text END AS role,
                               pg_catalog.jsonb_agg(pg_catalog.lower(a.privilege_type) ORDER BY a.privilege_type) AS privileges
                        FROM pg_catalog.aclexplode(c.relacl) a
                        GROUP BY a.grantee
                    ) g
                ), '[]'::pg_catalog.jsonb)
            ) ORDER BY c.relname)
            FROM pg_catalog.pg_class c
            WHERE c.relnamespace = 'public'::pg_catalog.regnamespace
              AND c.relname IN ('records', 'record_links', 'entity_sequences')
              AND c.relkind IN ('r', 'p')
        ), '[]'::pg_catalog.jsonb),
        'partitions', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'name', t.relname,
                'bound', pg_catalog.replace(
                    (pg_catalog.regexp_match(pg_catalog.pg_get_expr(t.relpartbound, t.oid), '^FOR VALUES IN \(''(.*)''\)$'))[1],
                    '''''', ''''),
                'constraints', COALESCE((
                    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'name', k.conname,
                        'kind', CASE k.contype WHEN 'p' THEN 'primary' WHEN 'u' THEN 'unique' WHEN 'c' THEN 'check' WHEN 'f' THEN 'foreign' ELSE 'exclude' END,
                        'definition', pg_catalog.pg_get_constraintdef(k.oid),
                        'validated', k.convalidated
                    ) ORDER BY k.conname)
                    FROM pg_catalog.pg_constraint k
                    WHERE k.conrelid = t.oid AND k.conislocal AND k.contype IN ('p', 'u', 'c', 'f', 'x')
                ), '[]'::pg_catalog.jsonb),
                'indexes', COALESCE((
                    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'name', ic.relname,
                        'columns', (
                            SELECT pg_catalog.jsonb_agg(
                                pg_catalog.pg_get_indexdef(i.indexrelid, s.k, true) || CASE WHEN (i.indoption[s.k - 1] & 1) = 1 THEN ' DESC' ELSE '' END
                                ORDER BY s.k)
                            FROM pg_catalog.generate_series(1, i.indnkeyatts::int) AS s(k)
                        ),
                        'unique', i.indisunique,
                        'method', am.amname,
                        'predicate', pg_catalog.pg_get_expr(i.indpred, i.indrelid)
                    ) ORDER BY ic.relname)
                    FROM pg_catalog.pg_index i
                    JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
                    JOIN pg_catalog.pg_am am ON am.oid = ic.relam
                    WHERE i.indrelid = t.oid
                      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_inherits ih WHERE ih.inhrelid = i.indexrelid)
                ), '[]'::pg_catalog.jsonb)
            ) ORDER BY t.relname)
            FROM pg_catalog.pg_inherits h
            JOIN pg_catalog.pg_class t ON t.oid = h.inhrelid
            WHERE h.inhparent = 'public.records'::pg_catalog.regclass
        ), '[]'::pg_catalog.jsonb),
        'views', COALESCE((
            SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'name', v.relname,
                'columns', (
                    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum)
                    FROM pg_catalog.pg_attribute a WHERE a.attrelid = v.oid AND a.attnum > 0 AND NOT a.attisdropped
                )
            ) ORDER BY v.relname)
            FROM pg_catalog.pg_class v
            WHERE v.relnamespace = 'public'::pg_catalog.regnamespace
              AND v.relkind = 'v'
              AND v.relname LIKE 'v\_records\_%'
        ), '[]'::pg_catalog.jsonb)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.engine_catalog() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engine_catalog() TO app_be;
