import { sql } from "@modules/platform/database"

/**
 * Creates one run and its token in one statement; only the hash of the token is stored, the token itself is answered once. A repeated
 * (workspace, template, dedupe key) creates nothing and answers no row ($1 workspace, $2 template, $3 dedupe key or null, $4 expiry).
 */
export const INSERT_N8N_RUN = sql`WITH ids AS (
    SELECT gen_random_uuid() AS run, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') AS secret
), created AS (
    INSERT INTO public.n8n_runs (id, workspace_id, template_key, dedupe_key, token_hash, expires_at)
    SELECT run, $1, $2, coalesce($3::text, run::text), encode(sha256(convert_to(run::text || '.' || secret, 'utf8')), 'hex'), $4 FROM ids
    ON CONFLICT (workspace_id, template_key, dedupe_key) DO NOTHING
    RETURNING id
)
SELECT created.id, ids.run::text || '.' || ids.secret AS token FROM created JOIN ids ON ids.run = created.id`

/** One run by id ($1 run). */
export const SELECT_N8N_RUN = sql`SELECT id, workspace_id, template_key, token_hash, expires_at, status FROM public.n8n_runs WHERE id = $1 LIMIT 1`

/** The settings and the approved wording of the pipeline a run belongs to ($1 workspace, $2 template). */
export const SELECT_RUN_PIPELINE = sql`SELECT config, body FROM public.automation_pipelines WHERE workspace_id = $1 AND template_key = $2 LIMIT 1`

/** Closes a run with how it ended ($1 run, $2 workspace, $3 status, $4 summary, $5 result). */
export const COMPLETE_N8N_RUN = sql`WITH changed AS (
    UPDATE public.n8n_runs SET status = $3, summary = $4, result = $5::jsonb, finished_at = now() WHERE id = $1 AND workspace_id = $2 RETURNING id
) SELECT id FROM changed`

/** The public url n8n calls back. */
export const SELECT_API_BASE = sql`SELECT value FROM public.n8n_platform_config WHERE key = 'api_base' LIMIT 1`
