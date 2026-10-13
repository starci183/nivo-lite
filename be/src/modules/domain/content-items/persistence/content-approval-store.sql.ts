import { sql } from "@modules/platform/database"

/** Claims the exact drafted version for one gate work item ($1 workspace, $2 item, $3 work, $4 evidence, $5 variants, $6 channels). */
export const CLAIM_CONTENT_SUBMISSION = sql`WITH changed AS (UPDATE public.content_items
SET status = 'waiting_approval', work_item_id = $3,
evidence = (SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array($4::jsonb)) WITH ORDINALITY AS history(line, ord)
WHERE ord > jsonb_array_length(evidence || jsonb_build_array($4::jsonb)) - 60)
WHERE workspace_id = $1 AND id = $2 AND status = 'draft' AND cardinality(channels) > 0
AND variants = $5::jsonb AND channels = $6::text[]
AND NOT EXISTS (SELECT 1 FROM unnest(channels) channel WHERE btrim(coalesce(variants -> channel ->> 'text', '')) = '')
RETURNING id) SELECT id FROM changed`

/** Approves only the post tied to this gate ($1 workspace, $2 item, $3 work, $4 by, $5 draft, $6 evidence, $7 at). */
export const APPROVE_CONTENT_SUBMISSION = sql`WITH changed AS (UPDATE public.content_items
SET status = 'approved', approved_by = $4, approved_at = $7,
variants = CASE WHEN $5::text IS NULL THEN variants ELSE jsonb_set(variants, ARRAY[channels[1], 'text'], to_jsonb($5::text), true) END,
evidence = (SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array($6::jsonb)) WITH ORDINALITY AS history(line, ord)
WHERE ord > jsonb_array_length(evidence || jsonb_build_array($6::jsonb)) - 60)
WHERE workspace_id = $1 AND id = $2 AND status = 'waiting_approval' AND work_item_id = $3
RETURNING id) SELECT id FROM changed`

/** Returns only this gate's waiting post to draft ($1 workspace, $2 item, $3 work, $4 evidence). */
export const REJECT_CONTENT_SUBMISSION = sql`WITH changed AS (UPDATE public.content_items
SET status = 'draft',
evidence = (SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array($4::jsonb)) WITH ORDINALITY AS history(line, ord)
WHERE ord > jsonb_array_length(evidence || jsonb_build_array($4::jsonb)) - 60)
WHERE workspace_id = $1 AND id = $2 AND status = 'waiting_approval' AND work_item_id = $3
RETURNING id) SELECT id FROM changed`

/** Adds one channel mark without replacing concurrent marks ($1 workspace, $2 item, $3 channel, $4 mark, $5 evidence, $6 at). */
export const MARK_CONTENT_PUBLISHED = sql`WITH changed AS (UPDATE public.content_items
SET published = published || jsonb_build_object($3::text, $4::jsonb),
status = CASE WHEN (published || jsonb_build_object($3::text, $4::jsonb)) ?& channels THEN 'published' ELSE status END,
published_at = CASE WHEN (published || jsonb_build_object($3::text, $4::jsonb)) ?& channels THEN $6::timestamptz ELSE published_at END,
evidence = (SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array($5::jsonb)) WITH ORDINALITY AS history(line, ord)
WHERE ord > jsonb_array_length(evidence || jsonb_build_array($5::jsonb)) - 60)
WHERE workspace_id = $1 AND id = $2 AND status IN ('approved', 'published') AND $3 = ANY(channels)
RETURNING id, status = 'published' AS "allDone") SELECT id, "allDone" FROM changed`
