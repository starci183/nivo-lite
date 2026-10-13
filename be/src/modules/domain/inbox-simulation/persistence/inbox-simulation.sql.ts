import { sql } from "@modules/platform/database"

/** The simulated event and its first department's work, confined to the proven workspace ($1 workspace, $2 event). */
export const FIND_SIMULATION_RESULT = sql`SELECT e.id, e.event_id, e.duplicate_count, e.amount_vnd::float8 AS amount_vnd,
    COALESCE(e.lead_id, w.lead_id) AS lead_id, e.status,
    w.id AS work_id, w.department AS work_department, w.status AS work_status,
    states.queued_count, states.failed_count, states.waiting_count
FROM public.inbound_events e
LEFT JOIN LATERAL (
    SELECT id, department, status, lead_id FROM public.work_items
    WHERE workspace_id = e.workspace_id AND inbound_event_id = e.id AND parent_id IS NULL
    ORDER BY created_at ASC, id ASC LIMIT 1
) w ON true
LEFT JOIN LATERAL (
    SELECT (COUNT(*) FILTER (WHERE status = 'queued'))::int AS queued_count,
        (COUNT(*) FILTER (WHERE status = 'failed'))::int AS failed_count,
        (COUNT(*) FILTER (WHERE status = 'waiting_decision'))::int AS waiting_count
    FROM public.work_items WHERE workspace_id = e.workspace_id AND inbound_event_id = e.id
) states ON true
WHERE e.workspace_id = $1::uuid AND e.id = $2::uuid AND e.origin = 'simulated'
LIMIT 1`

/** Generates a fresh event identity inside the same transaction that records the input. */
export const NEW_SIMULATION_EVENT_ID = sql`SELECT gen_random_uuid()::text AS id`
