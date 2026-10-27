import { sql } from "@modules/platform/database"

/** One invoice of the workspace ($1 workspace, $2 invoice). */
export const FIND_INVOICE = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
       contract_id, period_ends_on::text AS period_ends_on
FROM public.invoices WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The invoice of an order ($1 workspace, $2 order). */
export const FIND_INVOICE_OF_ORDER = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
       contract_id, period_ends_on::text AS period_ends_on
FROM public.invoices WHERE workspace_id = $1::uuid AND order_id = $2::uuid LIMIT 1`

/** The newest issued invoices with the order and customer labels ($1 workspace, $2 how many). */
export const LIST_ISSUED_INVOICES = sql`SELECT i.id, i.workspace_id, i.order_id, i.lead_id, i.invoice_no, i.amount_vnd::float8 AS amount_vnd, i.status, i.issued_by, i.paid_at::text AS paid_at,
       i.contract_id, i.period_ends_on::text AS period_ends_on, o.order_no, l.contact_name
FROM public.invoices i
LEFT JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.leads l ON l.id = i.lead_id
WHERE i.workspace_id = $1::uuid AND i.status = 'issued'
ORDER BY i.created_at DESC LIMIT $2::int`

/** The newest invoices with their dates, orders and customers for accounting ($1 workspace, $2 how many). */
export const LIST_ACCOUNTING_INVOICES = sql`
    SELECT i.id, i.workspace_id, i.order_id, i.lead_id, i.invoice_no, i.amount_vnd::float8 AS amount_vnd,
           i.status, i.issued_by, to_json(i.paid_at) #>> '{}' AS paid_at,
           i.contract_id, to_json(i.period_ends_on) #>> '{}' AS period_ends_on,
           to_json(i.issued_at) #>> '{}' AS issued_at, to_json(i.due_at) #>> '{}' AS due_at,
           to_json(i.created_at) #>> '{}' AS created_at,
           CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object(
               'order_no', o.order_no, 'items', o.items, 'amount_vnd', o.amount_vnd::float8, 'status', o.status
           ) END AS "order",
           CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object(
               'contact_name', l.contact_name, 'company', l.company
           ) END AS lead
    FROM public.invoices i
    LEFT JOIN public.orders o ON o.id = i.order_id AND o.workspace_id = i.workspace_id
    LEFT JOIN public.leads l ON l.id = i.lead_id AND l.workspace_id = i.workspace_id
    WHERE i.workspace_id = $1::uuid
    ORDER BY i.created_at DESC, i.id DESC LIMIT $2::int`

/**
 * The invoices a reconciliation proposes, with the customer, the order and both statuses
 * ($1 workspace, $2 invoice ids).
 */
export const LIST_RECONCILE_INVOICES = sql`
    SELECT i.id, i.invoice_no, i.amount_vnd::float8 AS amount_vnd, i.status,
           l.contact_name AS customer, NULLIF(l.company, '') AS company,
           o.order_no, NULLIF(o.items, '') AS order_items, o.status AS order_status,
           to_json(i.issued_at) #>> '{}' AS issued_at, to_json(i.due_at) #>> '{}' AS due_at
    FROM public.invoices i
    LEFT JOIN public.orders o ON o.id = i.order_id AND o.workspace_id = i.workspace_id
    LEFT JOIN public.leads l ON l.id = i.lead_id AND l.workspace_id = i.workspace_id
    WHERE i.workspace_id = $1::uuid AND i.id = ANY($2::uuid[])
    LIMIT 50`

/** The highest invoice number that starts with the prefix ($1 workspace, $2 prefix). */
export const LAST_INVOICE_NUMBER = sql`SELECT max(invoice_no) AS invoice_no
FROM public.invoices WHERE workspace_id = $1::uuid AND invoice_no LIKE $2 || '%'`

/** Issues an invoice; no row when the number is taken or the order has its invoice already ($1 workspace, $2 order, $3 lead, $4 number, $5 amount, $6 due, $7 issuer, $8 issue time). */
export const INSERT_INVOICE = sql`INSERT INTO public.invoices (workspace_id, order_id, lead_id, invoice_no, amount_vnd, due_at, status, issued_by, issued_at)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::bigint, $6::timestamptz, 'issued', $7, $8::timestamptz)
ON CONFLICT DO NOTHING
RETURNING id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
          contract_id, period_ends_on::text AS period_ends_on`

/** Marks an invoice paid ($1 workspace, $2 invoice, $3 payment time). */
export const MARK_INVOICE_PAID = sql`WITH changed AS (
    UPDATE public.invoices SET status = 'paid', paid_at = $3::timestamptz
    WHERE workspace_id = $1::uuid AND id = $2::uuid
    RETURNING id, workspace_id, order_id, lead_id, invoice_no, amount_vnd, status, issued_by, paid_at, contract_id, period_ends_on
)
SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
       contract_id, period_ends_on::text AS period_ends_on FROM changed`

/** The customer's newest invoice in one status: the newest paid one by payment time, else by creation ($1 workspace, $2 customer, $3 status). */
export const FIND_LATEST_LEAD_INVOICE = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
       contract_id, period_ends_on::text AS period_ends_on
FROM public.invoices WHERE workspace_id = $1::uuid AND lead_id = $2::uuid AND status = $3::text
ORDER BY CASE WHEN $3::text = 'paid' THEN paid_at END DESC NULLS LAST, created_at DESC LIMIT 1`

/** The renewal invoice of one contract period ($1 workspace, $2 contract, $3 the contract end date it renews). */
export const FIND_CONTRACT_PERIOD_INVOICE = sql`SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
       contract_id, period_ends_on::text AS period_ends_on
FROM public.invoices WHERE workspace_id = $1::uuid AND contract_id = $2::uuid AND period_ends_on = $3::date LIMIT 1`

/**
 * Issues the renewal invoice of a contract period; no row when the number is taken or the period has its invoice already
 * ($1 workspace, $2 contract, $3 period end, $4 lead, $5 number, $6 amount, $7 due, $8 issuer, $9 issue time).
 */
export const INSERT_RENEWAL_INVOICE = sql`INSERT INTO public.invoices (workspace_id, contract_id, period_ends_on, lead_id, invoice_no, amount_vnd, due_at, status, issued_by, issued_at)
VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $5, $6::bigint, $7::timestamptz, 'issued', $8, $9::timestamptz)
ON CONFLICT DO NOTHING
RETURNING id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at,
          contract_id, period_ends_on::text AS period_ends_on`
