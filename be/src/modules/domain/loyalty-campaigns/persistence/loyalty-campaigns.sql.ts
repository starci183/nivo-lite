import { sql } from "@modules/platform/database"

/** Writes a campaign as a draft and answers its id ($1 workspace, $2 name, $3 segment, $4 draft, $5 recipients, $6 created by). */
export const INSERT_CAMPAIGN = sql`INSERT INTO public.loyalty_campaigns (workspace_id, name, segment, draft, status, recipients, created_by)
VALUES ($1, $2, $3::jsonb, $4, 'draft', $5, $6)
RETURNING id`

/** How many promotions were sent since an instant ($1 workspace, $2 since). */
export const COUNT_SENT_SINCE = sql`SELECT count(*)::int AS total
FROM public.loyalty_sends
WHERE workspace_id = $1 AND status = 'sent' AND sent_at >= $2::timestamptz`

/** Creates a waiting draft ($1 workspace, $2 name, $3 segment, $4 fallback message, $5 recipients, $6 creator). */
export const INSERT_WAITING_CAMPAIGN = sql`INSERT INTO public.loyalty_campaigns (workspace_id, name, segment, draft, status, recipients, created_by)
VALUES ($1, $2, $3::jsonb, $4, 'waiting', $5, $6)
RETURNING id`

/** Reads recent campaigns and counts deliveries in the same workspace ($1 workspace, $2 optional campaign id, $3 limit). */
export const LIST_CAMPAIGNS = sql`SELECT c.id, c.name, c.segment, c.draft, c.status, c.work_item_id, c.recipients,
c.draft_ms, c.created_by, c.created_at, c.finished_at,
count(s.id) FILTER (WHERE s.status = 'sent')::int AS sent,
count(s.id) FILTER (WHERE s.status = 'queued')::int AS queued,
count(s.id) FILTER (WHERE s.status = 'failed')::int AS failed,
count(s.id) FILTER (WHERE s.status = 'skipped')::int AS skipped
FROM public.loyalty_campaigns c LEFT JOIN public.loyalty_sends s ON s.campaign_id = c.id AND s.workspace_id = c.workspace_id
WHERE c.workspace_id = $1 AND ($2::uuid IS NULL OR c.id = $2::uuid)
GROUP BY c.id ORDER BY c.created_at DESC, c.id DESC LIMIT $3`

/** Finishes a waiting message within the fenced writer's transaction ($1 workspace, $2 campaign, $3 message, $4 duration). */
export const FINISH_CAMPAIGN_DRAFT = sql`WITH changed AS (
UPDATE public.loyalty_campaigns c SET draft = $3, draft_ms = $4, status = 'draft'
WHERE c.workspace_id = $1 AND c.id = $2 AND c.status = 'waiting'
RETURNING c.id) SELECT id FROM changed`

/** Records terminal drafting failure without changing an already completed or approved campaign ($1 workspace, $2 campaign). */
export const FAIL_CAMPAIGN_DRAFT = sql`UPDATE public.loyalty_campaigns SET status = 'failed', finished_at = now()
WHERE workspace_id = $1 AND id = $2 AND status = 'waiting'`
