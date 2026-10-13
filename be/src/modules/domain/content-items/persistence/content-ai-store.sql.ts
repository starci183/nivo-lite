import { sql } from "@modules/platform/database"

/** A quick topic becomes an idea ($1 workspace, $2 title, $3 topic, $4 channels, $5 actor). */
export const INSERT_QUICK_IDEA = sql`INSERT INTO public.content_items
(workspace_id, title, brief, channels, status, source, created_by)
VALUES ($1, $2, $3, $4::text[], 'idea', 'quick', $5) RETURNING id, updated_at`

/** Changes only editable ideas; absent optional fields preserve the current values. */
export const APPLY_GENERATED_DRAFT = sql`WITH changed AS (UPDATE public.content_items SET
variants = $3::jsonb, hashtags = $4::text[], media = coalesce($5::jsonb, media),
channels = coalesce($6::text[], channels), pillar_id = coalesce($7::uuid, pillar_id),
title = coalesce($8::text, title), drafted_at = coalesce($9::timestamptz, now()), status = 'draft',
evidence = evidence || $10::jsonb
WHERE id = $1 AND workspace_id = $2 AND status IN ('idea', 'draft')
AND ($11::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = $11::timestamptz)
AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM public.content_pillars p WHERE p.id = $7 AND p.workspace_id = $2))
RETURNING id) SELECT id FROM changed`

/** Other recent titles keep an AI draft from repeating them ($1 workspace, $2 except item). */
export const SELECT_RECENT_CONTENT_TITLES = sql`SELECT title FROM public.content_items
WHERE workspace_id = $1 AND id <> $2 ORDER BY created_at DESC LIMIT 8`

/** Replaces only untouched generated ideas inside the requested Vietnam month. */
export const DELETE_UNTOUCHED_PLAN_IDEAS = sql`DELETE FROM public.content_items
WHERE workspace_id = $1 AND status = 'idea' AND source = 'plan'
AND scheduled_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
AND scheduled_at < (($2::date + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`

/** Inserts deterministic plan slots and the AI's titles/briefs as one set of rows. */
export const INSERT_PLANNED_IDEAS = sql`INSERT INTO public.content_items
(workspace_id, plan_id, title, brief, pillar_id, channels, scheduled_at, holiday_key, status, source, created_by, evidence)
SELECT $1::uuid, $2::uuid, r.title, r.brief, r.pillar_id, r.channels, r.scheduled_at, r.holiday_key,
'idea', 'plan', $4, $5::jsonb
FROM jsonb_to_recordset($3::jsonb) AS r(title text, brief text, pillar_id uuid, channels text[], scheduled_at timestamptz, holiday_key text)
JOIN public.content_pillars p ON p.id = r.pillar_id AND p.workspace_id = $1 RETURNING id`
