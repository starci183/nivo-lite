import { sql } from "@modules/platform/database"

/** Serializes plan replacement for one workspace without locking unrelated rows. */
export const LOCK_CONTENT_PLAN = sql`SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`

/** Stores a completed plan ($1 workspace, $2 month, $3 count, $4 ms, $5 metadata, $6 actor). */
export const INSERT_CONTENT_PLAN = sql`INSERT INTO public.content_plans
(workspace_id, month, status, idea_count, ai_ms, meta, created_by)
VALUES ($1, $2::date, 'done', $3, $4, $5::jsonb, $6) RETURNING id`
