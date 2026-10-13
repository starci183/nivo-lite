import { sql } from "@modules/platform/database"

/** One transaction of the workspace ($1 workspace, $2 transaction). */
export const FIND_TRANSACTION = sql`SELECT id, workspace_id, inbound_event_id, amount_vnd::float8 AS amount_vnd, reference, payer, invoice_id, status, origin
FROM public.transactions WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The newest payments and their input records for accounting ($1 workspace, $2 how many). */
export const LIST_ACCOUNTING_TRANSACTIONS = sql`
    SELECT t.id, t.workspace_id, t.inbound_event_id, t.channel, t.amount_vnd::float8 AS amount_vnd,
           t.reference, t.payer, t.invoice_id, t.status, t.origin,
           to_json(t.occurred_at) #>> '{}' AS occurred_at, to_json(t.created_at) #>> '{}' AS created_at,
           CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
               'channel', i.channel, 'event_id', i.event_id, 'body', i.body, 'sender_name', i.sender_name
           ) END AS inbound
    FROM public.transactions t
    LEFT JOIN public.inbound_events i ON i.id = t.inbound_event_id AND i.workspace_id = t.workspace_id
    WHERE t.workspace_id = $1::uuid
    ORDER BY t.occurred_at DESC, t.id DESC LIMIT $2::int`

/** Records a payment nobody matched yet ($1 workspace, $2 input, $3 amount, $4 reference, $5 payer, $6 origin). */
export const INSERT_TRANSACTION = sql`INSERT INTO public.transactions (workspace_id, inbound_event_id, channel, amount_vnd, reference, payer, status, origin)
VALUES ($1::uuid, $2::uuid, 'bank', $3::bigint, $4, $5, 'unmatched', $6)
RETURNING id, workspace_id, inbound_event_id, amount_vnd::float8 AS amount_vnd, reference, payer, invoice_id, status, origin`

/** Links a payment to the invoice it settled ($1 workspace, $2 transaction, $3 invoice). */
export const MATCH_TRANSACTION = sql`UPDATE public.transactions SET status = 'matched', invoice_id = $3::uuid
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** Sends a payment back to the owner's review ($1 workspace, $2 transaction). */
export const REVIEW_TRANSACTION = sql`UPDATE public.transactions SET status = 'needs_review'
WHERE workspace_id = $1::uuid AND id = $2::uuid`
