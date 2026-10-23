import { sql } from "@modules/platform/database"

/** One approval request as the sweep and the decisions left it, with how many verdicts it holds ($1 request). */
export const REQUEST_STATE = sql`
    SELECT status, resolved_by, escalated_to, jsonb_array_length(verdicts) AS verdicts
    FROM public.approval_requests WHERE id = $1`

/** Moves the deadline of a request into the past so the next sweep expires it ($1 request). */
export const EXPIRE_REQUEST_NOW = sql`UPDATE public.approval_requests SET expires_at = now() - interval '1 minute' WHERE id = $1`

/** The evidence lines of a workspace of one kind ($1 workspace, $2 kind). */
export const EVENTS_OF_KIND = sql`SELECT summary, evidence FROM public.events WHERE workspace_id = $1 AND kind = $2`

/** Deletes the five accounts of the story ($1 user ids). */
export const CLEAN_USERS = sql`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`

/** The work items of a customer in a workspace, oldest first, with the tax code their proposal carries ($1 workspace, $2 lead). */
export const WORK_ITEMS_OF_THREAD = sql`
    SELECT action, status, decided_path, proposal -> 'fields' ->> 'tax_code' AS tax_code
    FROM public.work_items
    WHERE workspace_id = $1 AND lead_id = $2
    ORDER BY created_at, id`
