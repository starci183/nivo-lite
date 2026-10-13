import { sql } from "@modules/platform/database"

/** One lead of a workspace ($1 workspace, $2 lead). */
export const SELECT_LEAD = sql`SELECT id, contact_name, company, channel, need, stage, phone, email, origin
FROM public.leads WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** One conversation of a workspace ($1 workspace, $2 conversation). */
export const SELECT_CONVERSATION = sql`SELECT id, channel, handled_by, visitor_name, lead_id
FROM public.agent_conversations WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** The latest real conversation of a lead (website chat, Telegram...): where a message to the customer leaves ($1 workspace, $2 lead). */
export const SELECT_LATEST_CONVERSATION = sql`SELECT id, channel, handled_by, visitor_name, lead_id
FROM public.agent_conversations WHERE workspace_id = $1 AND lead_id = $2 AND kind = 'customer' ORDER BY created_at DESC LIMIT 1`

/**
 * The leads created after an instant, newest first ($1 workspace, $2 since, $3 stages or null for every stage, $4 stage to leave out
 * or null, $5 limit).
 */
export const SELECT_SCAN_LEADS = sql`SELECT id, stage, created_at FROM public.leads
WHERE workspace_id = $1 AND created_at >= $2 AND ($3::text[] IS NULL OR stage = ANY($3::text[])) AND ($4::text IS NULL OR stage <> $4)
ORDER BY created_at DESC LIMIT $5`

/** The leads, among some, that have a real conversation; bounded by the ids ($1 workspace, $2 lead ids). */
export const SELECT_LEADS_WITH_CHAT = sql`SELECT DISTINCT lead_id FROM public.agent_conversations
WHERE workspace_id = $1 AND kind = 'customer' AND lead_id = ANY($2::uuid[]) LIMIT 500`

/** The instant of the last event of each lead; bounded by the ids ($1 workspace, $2 lead ids). */
export const SELECT_LEAD_ACTIVITY = sql`SELECT lead_id, max(created_at) AS last_at FROM public.events
WHERE workspace_id = $1 AND lead_id = ANY($2::uuid[]) GROUP BY lead_id LIMIT 500`

/** The figures of the day report from an instant on ($1 workspace, $2 start). */
export const SELECT_DAY_FIGURES = sql`SELECT
    (SELECT count(*) FROM public.leads WHERE workspace_id = $1 AND created_at >= $2)::int AS new_leads,
    (SELECT count(*) FROM public.orders WHERE workspace_id = $1 AND confirmed_at >= $2 AND status <> 'cancelled')::int AS confirmed_orders,
    (SELECT coalesce(sum(amount_vnd), 0) FROM public.orders WHERE workspace_id = $1 AND confirmed_at >= $2 AND status <> 'cancelled')::bigint AS confirmed_total,
    (SELECT coalesce(sum(amount_vnd), 0) FROM public.invoices WHERE workspace_id = $1 AND status = 'paid' AND paid_at >= $2)::bigint AS money_in,
    (SELECT count(*) FROM public.leads WHERE workspace_id = $1 AND stage = 'won' AND id IN (
        SELECT DISTINCT lead_id FROM public.events WHERE workspace_id = $1 AND kind = 'outcome.recorded' AND created_at >= $2 AND lead_id IS NOT NULL))::int AS won_leads,
    (SELECT coalesce(jsonb_agg(w.summary), '[]'::jsonb) FROM (
        SELECT proposal ->> 'summary' AS summary FROM public.work_items
        WHERE workspace_id = $1 AND status = 'waiting_decision' ORDER BY created_at LIMIT 50) w) AS waiting`

/** The issued invoices due before an instant, oldest first; bounded ($1 workspace, $2 cutoff). */
export const SELECT_DEBT_INVOICES = sql`SELECT id, invoice_no, amount_vnd, lead_id, due_at FROM public.invoices
WHERE workspace_id = $1 AND status = 'issued' AND due_at IS NOT NULL AND due_at < $2 ORDER BY due_at LIMIT 50`

/** One order of a workspace ($1 workspace, $2 order). */
export const SELECT_ORDER = sql`SELECT id, order_no, lead_id, shipped_at, carrier, tracking_code
FROM public.orders WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** One contract of a workspace ($1 workspace, $2 contract). */
export const SELECT_CONTRACT = sql`SELECT id, customer_name, lead_id, plan, ends_on::text AS ends_on, status
FROM public.contracts WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** The active contracts ending between two days, soonest first; bounded ($1 workspace, $2 first day, $3 last day). */
export const SELECT_EXPIRING_CONTRACTS = sql`SELECT id, ends_on::text AS ends_on FROM public.contracts
WHERE workspace_id = $1 AND status = 'active' AND ends_on >= $2 AND ends_on <= $3 ORDER BY ends_on LIMIT 100`

/** The name of the first active staff member of a workspace ($1 workspace). */
export const SELECT_FIRST_STAFF = sql`SELECT name FROM public.staff WHERE workspace_id = $1 AND active ORDER BY created_at LIMIT 1`

/** The built-in care message the gate sent, or still holds, for a lead since an instant ($1 workspace, $2 lead, $3 since). */
export const SELECT_BUILT_IN_CARE = sql`SELECT id FROM public.work_items
WHERE workspace_id = $1 AND lead_id = $2 AND action = 'send_care' AND status IN ('done', 'waiting_decision')
    AND dedupe_key LIKE 'send_care:%' AND created_at >= $3 LIMIT 1`
