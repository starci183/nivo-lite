import { sql } from "@modules/platform/database"

/**
 * Hybrid search over the passages of a workspace and the base knowledge of NIVO, filtered by the lens in SQL
 * ($1 workspace, $2 module, $3 query vector as pgvector text or null, $4 query text, $5 limit, $6 audience, $7 vector model or null, $8 installation or null).
 */
export const MATCH_KNOWLEDGE = sql`WITH q AS (
    SELECT
        trim(regexp_replace(public.knowledge_fold($4), '[^a-z0-9]+', ' ', 'g')) AS words,
        ($3::text IS NOT NULL AND $7::text IS NOT NULL) AS use_vec
), tsq AS (
    SELECT CASE WHEN q.words <> '' THEN to_tsquery('simple', array_to_string(regexp_split_to_array(q.words, '\\s+'), ' | ')) END AS query, q.use_vec FROM q
), business AS (
    SELECT 'business'::text AS layer, c.id, c.source_id, c.module, s.kind, s.title, c.content,
        (CASE WHEN tsq.use_vec AND c.embedding IS NOT NULL AND c.embedding_model = $7 THEN greatest(0, 1 - (c.embedding <=> $3::extensions.vector)) * 0.7 ELSE 0 END
            + CASE WHEN tsq.query IS NOT NULL THEN least(1, ts_rank(c.fts, tsq.query)) * 0.3 ELSE 0 END)::real AS score,
        c.visibility, s.topic,
        (tsq.use_vec AND c.embedding IS NOT NULL AND c.embedding_model = $7 AND (c.embedding <=> $3::extensions.vector) < 0.8)
            OR (tsq.query IS NOT NULL AND c.fts @@ tsq.query) AS hit
    FROM tsq, public.knowledge_chunks c
    JOIN public.knowledge_sources s ON s.id = c.source_id
    WHERE c.workspace_id = $1 AND (c.module IS NULL OR c.module = $2)
        AND ($6 <> 'customer' OR c.visibility = 'public')
        AND (s.installation_id IS NULL OR s.installation_id = $8::uuid)
), nivo AS (
    SELECT 'nivo'::text AS layer, k.id, NULL::uuid AS source_id, k.module, k.kind, k.title, k.body AS content,
        (CASE WHEN tsq.use_vec AND k.embedding IS NOT NULL AND k.embedding_model = $7 THEN greatest(0, 1 - (k.embedding <=> $3::extensions.vector)) * 0.7 ELSE 0 END
            + CASE WHEN tsq.query IS NOT NULL THEN least(1, ts_rank(k.fts, tsq.query)) * 0.3 ELSE 0 END)::real AS score,
        'internal'::text AS visibility, NULL::text AS topic,
        (tsq.use_vec AND k.embedding IS NOT NULL AND k.embedding_model = $7 AND (k.embedding <=> $3::extensions.vector) < 0.8)
            OR (tsq.query IS NOT NULL AND k.fts @@ tsq.query) AS hit
    FROM tsq, public.nivo_knowledge k
    WHERE k.module IN ($2, 'core')
), merged AS (
    SELECT * FROM business UNION ALL SELECT * FROM nivo
)
SELECT layer, id, source_id, module, kind, title, content, score, visibility, topic
FROM merged WHERE hit ORDER BY score DESC LIMIT greatest(1, least(coalesce($5, 8), 40))`

/** The audience (customer or internal) a module's agent speaks to ($1 module key). */
export const SELECT_MODULE_AUDIENCE = sql`SELECT audience FROM public.modules WHERE key = $1 LIMIT 1`
