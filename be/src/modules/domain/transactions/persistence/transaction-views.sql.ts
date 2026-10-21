import { sql } from "@modules/platform/database"

/** Payments linked to the given invoices of one workspace ($1 workspace, $2 invoices). */
export const LIST_INVOICE_TRANSACTIONS = sql`
    SELECT id, workspace_id, inbound_event_id, amount_vnd::float8 AS amount_vnd,
           reference, payer, invoice_id, status, channel,
           to_json(occurred_at) #>> '{}' AS occurred_at, to_json(created_at) #>> '{}' AS created_at
    FROM public.transactions
    WHERE workspace_id = $1::uuid AND invoice_id = ANY($2::uuid[])
    ORDER BY created_at ASC, id ASC LIMIT 1000`
