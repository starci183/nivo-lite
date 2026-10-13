import { sql } from "@modules/platform/database"

/** One pipeline of a workspace by template key ($1 workspace, $2 key). */
export const SELECT_PIPELINE = sql`SELECT id, workspace_id, template_key, name, module_key, enabled, dismissed, config, body, body_version,
    template_version, based_on_context, approval_streak, trust_offered_at, auto_send, created_at, updated_at
FROM public.automation_pipelines WHERE workspace_id = $1 AND template_key = $2 LIMIT 1`

/** One pipeline by id ($1 id). */
export const SELECT_PIPELINE_BY_ID = sql`SELECT id, workspace_id, template_key, name, module_key, enabled, dismissed, config, body, body_version,
    template_version, based_on_context, approval_streak, trust_offered_at, auto_send, created_at, updated_at
FROM public.automation_pipelines WHERE id = $1 LIMIT 1`

/** The pipelines that are on, of one workspace or of all ($1 workspace or null); bounded. */
export const SELECT_ENABLED_PIPELINES = sql`SELECT id, workspace_id, template_key, name, module_key, enabled, dismissed, config, body, body_version,
    template_version, based_on_context, approval_streak, trust_offered_at, auto_send, created_at, updated_at
FROM public.automation_pipelines WHERE enabled AND ($1::uuid IS NULL OR workspace_id = $1) ORDER BY created_at LIMIT 5000`

/** The id and template of every pipeline of a workspace; bounded ($1 workspace). */
export const SELECT_PIPELINE_KEYS = sql`SELECT id, template_key FROM public.automation_pipelines WHERE workspace_id = $1 LIMIT 500`

/**
 * Creates or replaces the pipeline of a template for a workspace ($1 workspace, $2 key, $3 name, $4 module, $5 template version,
 * $6 creator, $7 enabled, $8 dismissed, $9 config, $10 body, $11 body version, $12 context, $13 streak, $14 offered at, $15 auto send).
 */
export const UPSERT_PIPELINE = sql`INSERT INTO public.automation_pipelines (workspace_id, template_key, name, module_key, template_version, created_by,
    enabled, dismissed, config, body, body_version, based_on_context, approval_streak, trust_offered_at, auto_send, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, now())
ON CONFLICT (workspace_id, template_key) DO UPDATE
SET name = EXCLUDED.name, module_key = EXCLUDED.module_key, template_version = EXCLUDED.template_version,
    enabled = EXCLUDED.enabled, dismissed = EXCLUDED.dismissed, config = EXCLUDED.config, body = EXCLUDED.body,
    body_version = EXCLUDED.body_version, based_on_context = EXCLUDED.based_on_context, approval_streak = EXCLUDED.approval_streak,
    trust_offered_at = EXCLUDED.trust_offered_at, auto_send = EXCLUDED.auto_send, updated_at = now()
RETURNING id, workspace_id, template_key, name, module_key, enabled, dismissed, config, body, body_version,
    template_version, based_on_context, approval_streak, trust_offered_at, auto_send, created_at, updated_at`

/** Records the trust ladder after a decision ($1 pipeline, $2 streak, $3 offered at). */
export const UPDATE_PIPELINE_LADDER = sql`WITH changed AS (
    UPDATE public.automation_pipelines SET approval_streak = $2, trust_offered_at = $3, updated_at = now() WHERE id = $1 RETURNING id
) SELECT id FROM changed`
