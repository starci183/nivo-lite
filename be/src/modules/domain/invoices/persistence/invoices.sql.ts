import { sql } from "@modules/platform/database"

/** One invoice of the workspace ($1 workspace, $2 invoice). */
export const FIND_INVOICE = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, origin, issued_by, paid_at::text AS paid_at
FROM public.invoices WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The invoice of an order ($1 workspace, $2 order). */
export const FIND_INVOICE_OF_ORDER = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, origin, issued_by, paid_at::text AS paid_at
FROM public.invoices WHERE workspace_id = $1::uuid AND order_id = $2::uuid LIMIT 1`

/** The newest issued invoices of the same origin with the order and customer labels ($1 workspace, $2 how many, $3 origin). */
export const LIST_ISSUED_INVOICES = sql`SELECT i.id, i.workspace_id, i.order_id, i.lead_id, i.invoice_no, i.amount_vnd::float8 AS amount_vnd, i.status, i.origin, i.issued_by, i.paid_at::text AS paid_at,
       o.order_no, l.contact_name
FROM public.invoices i
LEFT JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.leads l ON l.id = i.lead_id
WHERE i.workspace_id = $1::uuid AND i.status = 'issued' AND COALESCE(i.origin, 'live') = $3::text
ORDER BY i.created_at DESC LIMIT $2::int`

/** The highest invoice number that starts with the prefix ($1 workspace, $2 prefix). */
export const LAST_INVOICE_NUMBER = sql`SELECT max(invoice_no) AS invoice_no
FROM public.invoices WHERE workspace_id = $1::uuid AND invoice_no LIKE $2 || '%'`

/** Issues an invoice; no row when the number is taken or the order has its invoice already ($1 workspace, $2 order, $3 lead, $4 number, $5 amount, $6 due, $7 origin, $8 issuer, $9 issue time). */
export const INSERT_INVOICE = sql`INSERT INTO public.invoices (workspace_id, order_id, lead_id, invoice_no, amount_vnd, due_at, status, origin, issued_by, issued_at)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::bigint, $6::timestamptz, 'issued', $7, $8, $9::timestamptz)
ON CONFLICT DO NOTHING
RETURNING id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, origin, issued_by, paid_at::text AS paid_at`

/** Marks an invoice of the payment's origin paid ($1 workspace, $2 invoice, $3 payment time, $4 origin). */
export const MARK_INVOICE_PAID = sql`WITH changed AS (
    UPDATE public.invoices SET status = 'paid', paid_at = $3::timestamptz
    WHERE workspace_id = $1::uuid AND id = $2::uuid AND COALESCE(origin, 'live') = $4::text
    RETURNING id, workspace_id, order_id, lead_id, invoice_no, amount_vnd, status, origin, issued_by, paid_at
)
SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, origin, issued_by, paid_at::text AS paid_at FROM changed`
