import { sql } from "@modules/platform/database"

/** The posts of a workspace due in a window, soonest first ($1 workspace, $2 from, $3 to). */
export const SELECT_ITEMS_BETWEEN = sql`SELECT id, title, status, channels, scheduled_at, pillar_id
FROM public.content_items
WHERE workspace_id = $1 AND scheduled_at >= $2 AND scheduled_at < $3
ORDER BY scheduled_at
LIMIT 500`

/** The newest post an offer already made with this title ($1 workspace, $2 title). */
export const SELECT_OFFER_ITEM = sql`SELECT id, status
FROM public.content_items
WHERE workspace_id = $1 AND source = 'offer' AND title = $2
ORDER BY created_at DESC
LIMIT 1`

/** Writes the idea of a post about an offer and answers its id ($1 workspace, $2 title, $3 brief, $4 theme or null, $5 channels, $6 evidence lines). */
export const INSERT_OFFER_IDEA = sql`INSERT INTO public.content_items (workspace_id, title, brief, pillar_id, channels, status, source, created_by, evidence)
VALUES ($1, $2, $3, $4, $5::text[], 'idea', 'offer', 'NIVO', $6::jsonb)
RETURNING id`

/**
 * Stores an agent-written draft ($1 workspace, $2 title, $3 brief, $4 channels, $5 scheduled_at, $6 variants json, $7 hashtags,
 * $8 media json, $9 evidence json, $10 actor); answers the id and the stored variants and channels.
 */
export const INSERT_AGENT_DRAFT = sql`INSERT INTO public.content_items
(workspace_id, title, brief, channels, scheduled_at, status, variants, hashtags, media, evidence, source, created_by, drafted_at)
VALUES ($1, $2, $3, $4, $5, 'draft', $6::jsonb, $7, $8::jsonb, $9::jsonb, 'quick', $10, now())
RETURNING id, variants, channels`

/** One post as the scheduler reads it ($1 workspace, $2 item). */
export const SELECT_SCHEDULE_ITEM = sql`SELECT id, title, channels, variants, media, to_json(scheduled_at) #>> '{}' AS scheduled_at
FROM public.content_items
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** Records where networks scheduled the post ($1 workspace, $2 item, $3 published json). */
export const MARK_ITEM_SCHEDULED = sql`UPDATE public.content_items SET published = published || $3::jsonb, updated_at = now()
WHERE workspace_id = $1 AND id = $2`

/**
 * The approved posts whose scheduled moment on one channel has come and that the channel has neither published nor refused, oldest
 * first ($1 channel, $2 now, $3 limit). Every workspace: the scheduler tick reads them; a published channel no longer has its `ref`.
 */
export const SELECT_DUE_CHANNEL_POSTS = sql`SELECT workspace_id, id, title, channels, variants, media,
to_json(scheduled_at) #>> '{}' AS scheduled_at, published -> $1::text ->> 'ref' AS ref
FROM public.content_items
WHERE status = 'approved' AND (published -> $1::text) ? 'ref' AND NOT ((published -> $1::text) ? 'failed_at')
AND (published -> $1::text ->> 'scheduled_at')::timestamptz <= $2::timestamptz
ORDER BY (published -> $1::text ->> 'scheduled_at')::timestamptz
LIMIT $3`

/** Records that one channel refused a due post, so the scheduler stops retrying it ($1 workspace, $2 item, $3 channel, $4 reason, $5 at). */
export const MARK_CHANNEL_FAILED = sql`UPDATE public.content_items
SET published = jsonb_set(published, ARRAY[$3::text], COALESCE(published -> $3::text, '{}'::jsonb)
|| jsonb_build_object('failed_at', $5::text, 'reason', $4::text)), updated_at = now()
WHERE workspace_id = $1 AND id = $2`
