import { sql } from "@modules/platform/database"

/** Transfers needing review, scoped through their payment orders ($1 workspace, $2 requested order ids). */
export const SELECT_REVIEW_TRANSACTIONS = sql`SELECT t.id::float8 AS id, t.status, t.transfer_amount::float8 AS transfer_amount, t.received_at, t.content
FROM public.sepay_transactions t
JOIN public.payment_orders o ON o.id = t.matched_order_id
WHERE o.workspace_id = $1 AND o.id = ANY($2::uuid[]) AND t.status IN ('underpaid', 'expired', 'unmatched')
ORDER BY t.received_at DESC
LIMIT 50`

/**
 * Claims one SePay transaction by its own id inside the receipt transaction. A duplicate, including a pending delivery,
 * returns no row: its committed outbox job owns retries and redelivery cannot publish another job.
 * $1 names the provider so the statement fits the shared inbox claim ($2 SePay id, $3 payload).
 */
export const INSERT_SEPAY_TRANSACTION = sql`INSERT INTO public.sepay_transactions (sepay_id, payload)
SELECT $2::bigint, $3::jsonb
WHERE $1::text = 'sepay'
ON CONFLICT (sepay_id) DO NOTHING
RETURNING id`

/** Marks the claimed SePay transaction processed in the deferred consumer transaction ($1 row id). */
export const COMPLETE_SEPAY_TRANSACTION = sql`WITH completed AS (
    UPDATE public.sepay_transactions
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed LIMIT 1`

/** Settles the pending order the code names with this transfer, atomically in SQL ($1 order code, $2 amount, $3 SePay id). */
export const SETTLE_PAYMENT_ORDER = sql`SELECT public.settle_payment_order($1, $2, $3) AS outcome`

/** Records what the delivery came to ($1 SePay id, $2 status, $3 amount or null, $4 content or null). */
export const UPDATE_SEPAY_RESULT = sql`UPDATE public.sepay_transactions
SET status = $2, transfer_amount = $3, content = $4
WHERE sepay_id = $1`

/** Locks one pending receipt; concurrent jobs and completed replays cannot repeat its effects. */
export const FIND_PENDING_SEPAY_INBOX = sql`SELECT id, payload FROM public.sepay_transactions
WHERE sepay_id = $1::bigint AND processed_at IS NULL
LIMIT 1
FOR UPDATE`
