import { sql } from "@modules/platform/database"

/** One item selected inside its workspace. */
export const FIND_CONTENT_ITEM = sql`SELECT * FROM public.content_items WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Bounded calendar items, optionally in a half-open window. */
export const LIST_CONTENT_ITEMS = sql`SELECT * FROM public.content_items
WHERE workspace_id = $1 AND ($2::timestamptz IS NULL OR scheduled_at >= $2)
AND ($3::timestamptz IS NULL OR scheduled_at < $3)
ORDER BY scheduled_at ASC NULLS LAST, created_at DESC LIMIT 500`

/** Workspace-safe theme lookup for an editor write. */
export const FIND_CONTENT_PILLAR = sql`SELECT id FROM public.content_pillars WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Creates a manual idea and its first history line. */
export const CREATE_CONTENT_ITEM = sql`INSERT INTO public.content_items
(workspace_id, title, channels, scheduled_at, pillar_id, status, source, created_by, evidence)
VALUES ($1, $2, $3::text[], $4, $5, 'idea', 'manual', $6, $7::jsonb) RETURNING *`

/** Edits the whitelisted fields under the row lock held by the capability. */
export const SAVE_CONTENT_ITEM = sql`WITH changed AS (UPDATE public.content_items SET
title = $3, brief = $4, pillar_id = $5, channels = $6::text[], scheduled_at = $7,
variants = $8::jsonb, hashtags = $9::text[], links = $10::jsonb, media = $11::jsonb,
status = $12, drafted_at = $13, evidence = $14::jsonb WHERE workspace_id = $1 AND id = $2 RETURNING *) SELECT * FROM changed`

/** Reads the item while serializing all editor writes. */
export const LOCK_CONTENT_ITEM = sql`SELECT * FROM public.content_items WHERE workspace_id = $1 AND id = $2 LIMIT 1 FOR UPDATE`

/** Removes only a deletable post. */
export const DELETE_CONTENT_ITEM = sql`WITH changed AS (DELETE FROM public.content_items WHERE workspace_id = $1 AND id = $2
AND status IN ('idea', 'draft', 'skipped') RETURNING id) SELECT id FROM changed`

/** Persists a permitted lifecycle transition and its evidence. */
export const TRANSITION_CONTENT_ITEM = sql`WITH changed AS (UPDATE public.content_items SET status = $3, evidence = $4::jsonb,
approved_by = CASE WHEN $5 THEN NULL ELSE approved_by END,
approved_at = CASE WHEN $5 THEN NULL ELSE approved_at END WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed`

/** Figures calculated with Vietnam month boundaries supplied by the clock. */
export const CONTENT_FIGURES = sql`SELECT
(SELECT count(*)::int FROM public.content_items WHERE workspace_id = $1 AND status = 'waiting_approval') AS awaiting_approval,
(SELECT count(*)::int FROM public.content_items WHERE workspace_id = $1 AND status = 'published' AND published_at >= $2::timestamptz - interval '30 days') AS published_30,
(SELECT count(*)::int FROM public.content_pillars p WHERE p.workspace_id = $1 AND p.active AND EXISTS
(SELECT 1 FROM public.content_items i WHERE i.workspace_id = $1 AND i.pillar_id = p.id AND i.status <> 'skipped' AND i.scheduled_at >= $3 AND i.scheduled_at < $4)) AS covered,
(SELECT count(*)::int FROM public.content_pillars WHERE workspace_id = $1 AND active) AS total`

/** The next approved post. */
export const NEXT_CONTENT_ITEM = sql`SELECT * FROM public.content_items WHERE workspace_id = $1
AND status = 'approved' AND scheduled_at >= $2 ORDER BY scheduled_at LIMIT 1`

/** Last completed editorial plan. */
export const LAST_CONTENT_PLAN = sql`SELECT month, idea_count, ai_ms, created_at FROM public.content_plans
WHERE workspace_id = $1 AND status = 'done' ORDER BY created_at DESC LIMIT 1`
