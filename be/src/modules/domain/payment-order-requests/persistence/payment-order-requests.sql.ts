import { sql } from "@modules/platform/database"

/** Inserts an authorized manager's request ($1 workspace, $2 caller, $3 kind, $4 target, $5 cycle, $6 usage tier, $7 seats). */
export const INSERT_REQUEST = sql`INSERT INTO public.payment_order_requests (workspace_id, requested_by, kind, target, cycle, tier_credits, seats)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id`

/** Enqueues the existing fenced job inside the request transaction ($1 workspace, $2 queue, $3 request). */
export const ENQUEUE_REQUEST = sql`SELECT public.job_enqueue(
$1, $2, $2, jsonb_build_object('workspaceId', $1::text, 'requestId', $3::text), 'payment-order-request:' || $3::text)`

/** The caller's own request in the selected workspace ($1 request, $2 workspace, $3 caller). */
export const SELECT_REQUEST_STATUS = sql`SELECT r.id, r.status, r.order_id, r.fault
FROM public.payment_order_requests r
WHERE r.id = $1 AND r.workspace_id = $2 AND r.requested_by = $3
LIMIT 1`

/** One request of a workspace by its id ($1 request, $2 workspace). */
export const SELECT_REQUEST = sql`SELECT id, workspace_id, requested_by, kind, target, cycle, tier_credits::float8 AS tier_credits, seats, status
FROM public.payment_order_requests
WHERE id = $1 AND workspace_id = $2
LIMIT 1`

/** Answers a pending request with the order that was made ($1 request, $2 order). */
export const MARK_REQUEST_DONE = sql`UPDATE public.payment_order_requests
SET status = 'done', order_id = $2, answered_at = now()
WHERE id = $1 AND status = 'pending'`

/** Answers a pending request with the code of the refusal ($1 request, $2 error code). */
export const MARK_REQUEST_FAILED = sql`UPDATE public.payment_order_requests
SET status = 'failed', fault = $2, answered_at = now()
WHERE id = $1 AND status = 'pending'`

/** Ends a request whose job will never retry ($1 request, $2 workspace, $3 stable error code). */
export const MARK_EXHAUSTED_REQUEST_FAILED = sql`UPDATE public.payment_order_requests
SET status = 'failed', fault = $3, answered_at = now()
WHERE id = $1 AND workspace_id = $2 AND status = 'pending'`
