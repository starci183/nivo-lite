import { sql } from "@modules/platform/database"

/** Upserts the reported days of one channel ($1 workspace, $2 channel, $3 days json [{day, reach, engagements}]). */
export const UPSERT_ENGAGEMENT_DAYS = sql`INSERT INTO public.content_engagement_daily (workspace_id, channel, day, reach, engagements)
SELECT $1, $2, (entry ->> 'day')::date, (entry ->> 'reach')::integer, (entry ->> 'engagements')::integer
FROM jsonb_array_elements($3::jsonb) AS entry
ON CONFLICT (workspace_id, channel, day) DO UPDATE SET reach = excluded.reach, engagements = excluded.engagements,
synced_at = now()`

/** The daily rows between two days ($1 workspace, $2 from inclusive, $3 to exclusive). */
export const LIST_ENGAGEMENT_DAYS = sql`SELECT channel, to_char(day, 'YYYY-MM-DD') AS day, reach, engagements, messages
FROM public.content_engagement_daily
WHERE workspace_id = $1 AND day >= $2::date AND day < $3::date
ORDER BY day, channel
LIMIT 400`

/** Upserts the new customer messages of channel days, keeping their reach and engagements ($1 workspace, $2 days json [{channel, day, messages}]). */
export const UPSERT_MESSAGE_DAYS = sql`INSERT INTO public.content_engagement_daily (workspace_id, channel, day, messages)
SELECT $1, entry ->> 'channel', (entry ->> 'day')::date, (entry ->> 'messages')::integer
FROM jsonb_array_elements($2::jsonb) AS entry
ON CONFLICT (workspace_id, channel, day) DO UPDATE SET messages = excluded.messages, synced_at = now()`
