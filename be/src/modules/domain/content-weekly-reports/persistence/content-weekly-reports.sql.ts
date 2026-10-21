import { sql } from "@modules/platform/database"

/** The stored week of a workspace ($1 workspace, $2 week start). */
export const FIND_WEEKLY_REPORT = sql`SELECT posts, post_count, suggestion, to_json(computed_at) #>> '{}' AS computed_at,
to_json(posted_at) #>> '{}' AS posted_at
FROM public.content_weekly_reports
WHERE workspace_id = $1 AND week_start = $2::date
LIMIT 1`

/** Stores the extras of a week, keeping when its card was posted ($1 workspace, $2 week, $3 posts json, $4 count, $5 suggestion json or null, $6 at). */
export const UPSERT_WEEKLY_EXTRAS = sql`INSERT INTO public.content_weekly_reports (workspace_id, week_start, posts, post_count, suggestion, computed_at)
VALUES ($1, $2::date, $3::jsonb, $4, $5::jsonb, $6::timestamptz)
ON CONFLICT (workspace_id, week_start) DO UPDATE SET posts = excluded.posts, post_count = excluded.post_count,
suggestion = excluded.suggestion, computed_at = excluded.computed_at`

/** Claims the posting of a week's card once ($1 workspace, $2 week, $3 at); answers a row only for the call that claimed it. */
export const CLAIM_WEEKLY_POST = sql`INSERT INTO public.content_weekly_reports (workspace_id, week_start, posted_at)
VALUES ($1, $2::date, $3::timestamptz)
ON CONFLICT (workspace_id, week_start) DO UPDATE SET posted_at = excluded.posted_at
WHERE public.content_weekly_reports.posted_at IS NULL
RETURNING to_char(week_start, 'YYYY-MM-DD') AS week_start`
