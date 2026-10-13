import { sql } from "@modules/platform/database"

/** The just-enqueued Sales action ($1 workspace, $2 queue dedupe key). */
export const FIND_ACTION_BY_KEY = sql`SELECT o.id, o.state, COALESCE(o.payload->>'workItemId', e.work_item_id::text) AS work_item_id,
w.status AS work_status, CASE WHEN o.payload ? 'workItemId' OR e.work_item_id IS NOT NULL THEN w.id IS NOT NULL
WHEN o.payload ? 'executionId' THEN e.id IS NOT NULL ELSE s.id IS NOT NULL END AS target_found
FROM public.job_outbox o LEFT JOIN public.executions e ON e.id::text = o.payload->>'executionId' AND e.workspace_id = o.workspace_id
LEFT JOIN public.work_items w ON w.id::text = COALESCE(o.payload->>'workItemId', e.work_item_id::text) AND w.workspace_id = o.workspace_id
LEFT JOIN public.orders s ON s.id::text = o.payload->>'orderId' AND s.workspace_id = o.workspace_id
WHERE o.workspace_id = $1::uuid AND o.dedupe_key = $2 AND
(o.queue = 'decisions' OR (o.queue = 'automation' AND o.name = 'automation.tick' AND o.payload->>'kind' = 'shipment')) LIMIT 1`

/** One Sales action the member may poll ($1 workspace, $2 outbox id). */
export const FIND_ACTION_STATUS = sql`SELECT o.id, o.state, COALESCE(o.payload->>'workItemId', e.work_item_id::text) AS work_item_id,
w.status AS work_status, CASE WHEN o.payload ? 'workItemId' OR e.work_item_id IS NOT NULL THEN w.id IS NOT NULL
WHEN o.payload ? 'executionId' THEN e.id IS NOT NULL ELSE s.id IS NOT NULL END AS target_found
FROM public.job_outbox o LEFT JOIN public.executions e ON e.id::text = o.payload->>'executionId' AND e.workspace_id = o.workspace_id
LEFT JOIN public.work_items w ON w.id::text = COALESCE(o.payload->>'workItemId', e.work_item_id::text) AND w.workspace_id = o.workspace_id
LEFT JOIN public.orders s ON s.id::text = o.payload->>'orderId' AND s.workspace_id = o.workspace_id
WHERE o.workspace_id = $1::uuid AND o.id = $2::uuid AND
(o.queue = 'decisions' OR (o.queue = 'automation' AND o.name = 'automation.tick' AND o.payload->>'kind' = 'shipment')) LIMIT 1`
