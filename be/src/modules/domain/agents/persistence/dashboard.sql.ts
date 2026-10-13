import { sql } from "@modules/platform/database"

/**
 * The oldest decisions of a department that wait for a person, test runs left out, with the total before the limit
 * ($1 workspace, $2 department, $3 instance or null for the whole department, $4 test-run pattern, $5 limit).
 */
export const LIST_WAITING_ITEMS = sql`SELECT w.id, w.action, w.lead_id, w.created_at AS at, w.proposal->>'summary' AS summary,
    COALESCE(l.contact_name, w.proposal->'fields'->>'customer') AS customer, NULL::text AS result_href, count(*) OVER () AS total
FROM public.work_items w
LEFT JOIN public.leads l ON l.id = w.lead_id
WHERE w.workspace_id = $1 AND w.department = $2 AND w.status = 'waiting_decision'
    AND ($3::uuid IS NULL OR w.installation_id = $3)
    AND NOT (concat_ws(' ', l.contact_name, l.company, w.proposal->>'summary', w.proposal->'fields'->>'contact_name', w.proposal->'fields'->>'customer') ~ $4)
ORDER BY w.created_at, w.id
LIMIT $5`

/**
 * The latest work of a department finished by policy since an instant, test runs left out, with the total before the limit
 * ($1 workspace, $2 department, $3 instance or null, $4 test-run pattern, $5 since, $6 limit).
 */
export const LIST_DONE_ITEMS = sql`SELECT w.id, w.action, w.lead_id, COALESCE(w.completed_at, w.updated_at) AS at,
    COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary') AS summary,
    COALESCE(l.contact_name, w.proposal->'fields'->>'customer') AS customer, w.result->>'href' AS result_href, count(*) OVER () AS total
FROM public.work_items w
LEFT JOIN public.leads l ON l.id = w.lead_id
WHERE w.workspace_id = $1 AND w.department = $2 AND w.status = 'done' AND w.decided_path = 'auto' AND w.completed_at >= $5
    AND ($3::uuid IS NULL OR w.installation_id = $3)
    AND NOT (concat_ws(' ', l.contact_name, l.company, w.proposal->>'summary', w.proposal->'fields'->>'contact_name', w.proposal->'fields'->>'customer') ~ $4)
ORDER BY w.completed_at DESC, w.id
LIMIT $6`
