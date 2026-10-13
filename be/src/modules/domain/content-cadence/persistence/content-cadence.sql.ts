import { sql } from "@modules/platform/database"

/** All channel rhythms of a workspace ($1). */
export const SELECT_CONFIGURATION_CADENCE = sql`SELECT id, workspace_id, channel, posts_per_week, days, post_time
FROM public.content_cadence WHERE workspace_id = $1 ORDER BY channel LIMIT 4`

/** Removes rhythms omitted from the replacement ($1 workspace, $2 retained channels). */
export const DELETE_CONFIGURATION_CADENCE = sql`DELETE FROM public.content_cadence
WHERE workspace_id = $1 AND NOT (channel = ANY($2::text[]))`

/** Saves all submitted rhythms ($1 workspace, $2 bounded rows). */
export const SAVE_CONFIGURATION_CADENCE = sql`INSERT INTO public.content_cadence (workspace_id, channel, posts_per_week, days, post_time)
SELECT $1, r.channel, r.posts_per_week, r.days, r.post_time
FROM jsonb_to_recordset($2::jsonb) AS r(channel text, posts_per_week int, days int[], post_time text)
ON CONFLICT (workspace_id, channel) DO UPDATE SET posts_per_week = EXCLUDED.posts_per_week,
days = EXCLUDED.days, post_time = EXCLUDED.post_time`
