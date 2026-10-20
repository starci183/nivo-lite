import { sql } from "@modules/platform/database"

/** The latest bank credits of a workspace, optionally of one status and after an instant. */
export const LIST_BANK_TRANSACTIONS = sql`
    SELECT t.id, t.amount_vnd, t.reference, t.payer, t.status, t.occurred_at
    FROM public.transactions t
    WHERE t.workspace_id = $1 AND t.channel = 'bank' AND t.origin = 'live'
      AND ($2::text IS NULL OR t.status = $2)
      AND ($3::timestamptz IS NULL OR t.occurred_at >= $3)
    ORDER BY t.occurred_at DESC
    LIMIT $4`
