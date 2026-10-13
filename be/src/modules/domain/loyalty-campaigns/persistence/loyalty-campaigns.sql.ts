import { sql } from "@modules/platform/database"

/** Writes a campaign as a draft and answers its id ($1 workspace, $2 name, $3 segment, $4 draft, $5 recipients, $6 created by). */
export const INSERT_CAMPAIGN = sql`INSERT INTO public.loyalty_campaigns (workspace_id, name, segment, draft, status, recipients, created_by)
VALUES ($1, $2, $3::jsonb, $4, 'draft', $5, $6)
RETURNING id`

/** How many promotions were sent since an instant ($1 workspace, $2 since). */
export const COUNT_SENT_SINCE = sql`SELECT count(*)::int AS total
FROM public.loyalty_sends
WHERE workspace_id = $1 AND status = 'sent' AND sent_at >= $2::timestamptz`
