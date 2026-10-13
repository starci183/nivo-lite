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
