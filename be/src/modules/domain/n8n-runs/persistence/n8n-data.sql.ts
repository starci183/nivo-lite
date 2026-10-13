import { sql } from "@modules/platform/database"

/** The owners and managers of a workspace; bounded ($1 workspace). */
export const SELECT_OWNER_MEMBERS = sql`SELECT user_id, display_name FROM public.workspace_members
WHERE workspace_id = $1 AND status = 'active' AND role IN ('owner', 'manager') LIMIT 50`

/** The name of a workspace ($1 workspace). */
export const SELECT_SHOP_NAME = sql`SELECT name FROM public.workspaces WHERE id = $1 LIMIT 1`

/** The figures of one day of a workspace ($1 workspace, $2 start, $3 end, $4 now). */
export const SELECT_DAY_NUMBERS = sql`SELECT
    (SELECT count(*) FROM public.leads WHERE workspace_id = $1 AND created_at >= $2 AND created_at < $3)::int AS new_leads,
    (SELECT count(*) FROM public.orders WHERE workspace_id = $1 AND origin = 'live' AND confirmed_at >= $2 AND confirmed_at < $3)::int AS orders_confirmed,
    (SELECT coalesce(sum(amount_vnd), 0) FROM public.transactions WHERE workspace_id = $1 AND origin = 'live' AND occurred_at >= $2 AND occurred_at < $3)::bigint AS money_in,
    (SELECT count(*) FROM public.transactions WHERE workspace_id = $1 AND origin = 'live' AND occurred_at >= $2 AND occurred_at < $3)::int AS money_in_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM public.invoices WHERE workspace_id = $1 AND origin = 'live' AND status = 'issued' AND issued_at >= $2 AND issued_at < $3)::bigint AS invoiced,
    (SELECT count(*) FROM public.invoices WHERE workspace_id = $1 AND origin = 'live' AND status = 'issued' AND issued_at >= $2 AND issued_at < $3)::int AS invoices_issued,
    (SELECT count(*) FROM public.work_items WHERE workspace_id = $1 AND status = 'waiting_decision')::int AS waiting_decisions,
    (SELECT count(*) FROM public.invoices WHERE workspace_id = $1 AND origin = 'live' AND status = 'issued' AND due_at < $4)::int AS overdue_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM public.invoices WHERE workspace_id = $1 AND origin = 'live' AND status = 'issued' AND due_at < $4)::bigint AS overdue_total`

/** The live issued invoices due before an instant, oldest first; bounded ($1 workspace, $2 cutoff). */
export const SELECT_OVERDUE_INVOICES = sql`SELECT id, invoice_no, amount_vnd, due_at, lead_id FROM public.invoices
WHERE workspace_id = $1 AND origin = 'live' AND status = 'issued' AND due_at < $2 ORDER BY due_at LIMIT 200`

/** The name and address of some leads; bounded by the ids ($1 lead ids). */
export const SELECT_LEAD_CONTACTS = sql`SELECT id, contact_name, email FROM public.leads WHERE id = ANY($1::uuid[]) LIMIT 200`

/** The invoices a debt reminder was sent or is waiting for since an instant; bounded ($1 workspace, $2 since). */
export const SELECT_REMINDED_INVOICES = sql`SELECT DISTINCT refs ->> 'invoice_id' AS invoice_id FROM public.email_messages
WHERE workspace_id = $1 AND purpose = 'debt_reminder' AND status IN ('sent', 'waiting_decision') AND created_at >= $2 LIMIT 500`

/** The live money received in a period, oldest first; bounded ($1 workspace, $2 from, $3 to). */
export const SELECT_LEDGER_TRANSACTIONS = sql`SELECT occurred_at, amount_vnd, reference, payer, channel, status FROM public.transactions
WHERE workspace_id = $1 AND origin = 'live' AND occurred_at >= $2 AND occurred_at < $3 ORDER BY occurred_at LIMIT 5000`

/** The live invoices issued in a period, oldest first; bounded ($1 workspace, $2 from, $3 to). */
export const SELECT_LEDGER_INVOICES = sql`SELECT invoice_no, amount_vnd, issued_at, status FROM public.invoices
WHERE workspace_id = $1 AND origin = 'live' AND status <> 'draft' AND issued_at >= $2 AND issued_at < $3 ORDER BY issued_at LIMIT 5000`

/** The invoice a receipt is for ($1 workspace, $2 invoice). */
export const SELECT_RECEIPT_INVOICE = sql`SELECT id, invoice_no, amount_vnd, lead_id, paid_at FROM public.invoices WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** The payment a receipt is for ($1 workspace, $2 transaction). */
export const SELECT_RECEIPT_TRANSACTION = sql`SELECT invoice_id, amount_vnd, occurred_at FROM public.transactions WHERE workspace_id = $1 AND id = $2 LIMIT 1`
