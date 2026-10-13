import { sql } from "@modules/platform/database"

/** One request of a workspace by its id ($1 request, $2 workspace). */
export const SELECT_REQUEST = sql`SELECT id, workspace_id, requested_by, kind, target, status
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
