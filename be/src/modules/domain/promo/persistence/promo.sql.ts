import { sql } from "@modules/platform/database"

/** The earliest chatbot of a workspace ($1 workspace). */
export const FIND_PROMO_CHATBOT = sql`SELECT id, handle, name FROM public.agents
    WHERE workspace_id = $1::uuid AND module = 'chatbot'
    ORDER BY created_at, id LIMIT 1`

/** Whether a module was bought within the campaign window ($1 workspace, $2 start, $3 end). */
export const FIND_FOUNDING_MEMBER = sql`SELECT EXISTS (
    SELECT 1 FROM public.events WHERE workspace_id = $1::uuid AND kind = 'module.purchased'
        AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
) AS is_founding_member`

/** Promo read projection; every subquery is workspace-scoped ($1 workspace, $2 start, $3 end, $4 historical invoice title). */
export const FIND_PROMO_STATE = sql`WITH website AS (
    SELECT id, created_at FROM public.leads WHERE workspace_id = $1::uuid AND channel ILIKE '%website%'
), first_events AS (
    SELECT e.lead_id, MIN(e.created_at) AS at FROM public.events e
    JOIN website w ON w.id = e.lead_id
    WHERE e.workspace_id = $1::uuid AND e.kind IN ('execution.approved', 'responsibility.assigned')
    GROUP BY e.lead_id
), chatbot AS (
    SELECT id, knowledge FROM public.agents WHERE workspace_id = $1::uuid AND module = 'chatbot'
    ORDER BY created_at, id LIMIT 1
), approved AS (
    SELECT responsibility_id FROM public.executions WHERE workspace_id = $1::uuid AND status = 'approved'
)
SELECT (SELECT id FROM chatbot) AS chatbot_id,
    COALESCE((SELECT LENGTH(BTRIM(knowledge)) > 0 FROM chatbot), false) AS has_knowledge,
    EXISTS (SELECT 1 FROM public.events WHERE workspace_id = $1::uuid AND kind = 'module.purchased'
        AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz) AS is_founding_member,
    (SELECT COUNT(*)::int FROM website) AS website_count,
    (SELECT COUNT(*)::int FROM website WHERE EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok') < 8
        OR EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok') >= 18) AS after_hours_count,
    (SELECT AVG(EXTRACT(EPOCH FROM (f.at - w.created_at)) / 3600)::float8 FROM website w
        JOIN first_events f ON f.lead_id = w.id WHERE f.at >= w.created_at) AS avg_wait_hours,
    EXISTS (SELECT 1 FROM public.agent_conversations WHERE workspace_id = $1::uuid AND kind = 'customer')
        AS has_customer_conversation,
    EXISTS (SELECT 1 FROM public.agent_conversations WHERE workspace_id = $1::uuid AND lead_id IS NOT NULL)
        AS has_lead_conversation,
    EXISTS (SELECT 1 FROM approved) AS has_approved,
    EXISTS (SELECT 1 FROM public.events e JOIN public.leads l ON l.id = e.lead_id
        WHERE e.workspace_id = $1::uuid AND l.workspace_id = $1::uuid
        AND e.kind = 'outcome.recorded' AND l.stage = 'won') AS has_won,
    EXISTS (SELECT 1 FROM public.responsibilities r JOIN approved a ON a.responsibility_id = r.id
        WHERE r.workspace_id = $1::uuid AND (r.title ILIKE 'Prepare invoice%' OR r.title ILIKE $4::text))
        AS invoice_approved`

/** Lead delay and its first approved reply ($1 workspace, $2 lead, $3 now). */
export const FIND_LEAD_WAIT = sql`WITH lead AS (
    SELECT channel, created_at FROM public.leads WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1
), reply AS (
    SELECT MIN(created_at) AS at FROM public.events
    WHERE workspace_id = $1::uuid AND lead_id = $2::uuid AND kind = 'execution.approved'
), wait AS (
    SELECT channel ILIKE '%website%' AND NOT EXISTS (
        SELECT 1 FROM public.agents WHERE workspace_id = $1::uuid AND module = 'chatbot'
    ) AS show, FLOOR(EXTRACT(EPOCH FROM (COALESCE(reply.at, $3::timestamptz) - lead.created_at)) / 3600) AS hours,
        reply.at IS NOT NULL AS replied FROM lead CROSS JOIN reply
)
SELECT show, CASE WHEN show AND hours >= 1 THEN hours::int ELSE NULL END AS hours,
    show AND replied AS replied FROM wait LIMIT 1`
