import { sql } from "@modules/platform/database"

/**
 * The renewal-to-cash story of a window, read only: the renewal invoices issued in it, the renewal invoices paid in it with the
 * contract's end date now, the invoices still unpaid that fall due before the horizon, the active contracts ending before the
 * horizon with no renewal invoice for their period, and the payments received that still wait for a decision. Each list is
 * bounded; the counts and totals cover every row ($1 workspace, $2 window start, $3 window end, $4 first day `yyyy-mm-dd`,
 * $5 horizon day `yyyy-mm-dd`, $6 list bound).
 */
export const SELECT_RENEWAL_CASH = sql`WITH issued AS (
    SELECT i.invoice_no, i.amount_vnd, c.customer_name, i.issued_at
    FROM public.invoices i JOIN public.contracts c ON c.id = i.contract_id AND c.workspace_id = i.workspace_id
    WHERE i.workspace_id = $1::uuid AND i.status <> 'cancelled'
        AND i.issued_at >= $2::timestamptz AND i.issued_at < $3::timestamptz
), paid AS (
    SELECT i.invoice_no, i.amount_vnd, c.customer_name, i.paid_at, i.period_ends_on, c.ends_on
    FROM public.invoices i JOIN public.contracts c ON c.id = i.contract_id AND c.workspace_id = i.workspace_id
    WHERE i.workspace_id = $1::uuid AND i.status = 'paid'
        AND i.paid_at >= $2::timestamptz AND i.paid_at < $3::timestamptz
), unpaid AS (
    SELECT i.invoice_no, i.amount_vnd, coalesce(c.customer_name, l.contact_name) AS customer_name, i.due_at
    FROM public.invoices i
    LEFT JOIN public.contracts c ON c.id = i.contract_id AND c.workspace_id = i.workspace_id
    LEFT JOIN public.leads l ON l.id = i.lead_id AND l.workspace_id = i.workspace_id
    WHERE i.workspace_id = $1::uuid AND i.status = 'issued' AND i.due_at IS NOT NULL
        AND i.due_at < ($5::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
), expiring AS (
    SELECT c.customer_name, c.plan, c.ends_on, c.amount_vnd
    FROM public.contracts c
    WHERE c.workspace_id = $1::uuid AND c.status = 'active' AND c.ends_on >= $4::date AND c.ends_on <= $5::date
        AND NOT EXISTS (
            SELECT 1 FROM public.invoices i
            WHERE i.workspace_id = c.workspace_id AND i.contract_id = c.id AND i.period_ends_on = c.ends_on
                AND i.status <> 'cancelled'
        )
), unmatched AS (
    SELECT e.amount_vnd, e.sender_name, coalesce(e.external_ref, e.body) AS memo, e.created_at
    FROM public.inbound_events e
    WHERE e.workspace_id = $1::uuid AND e.kind = 'payment' AND e.status = 'needs_decision'
)
SELECT
    (SELECT count(*) FROM issued)::int AS issued_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM issued)::float8 AS issued_total,
    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT invoice_no, amount_vnd::float8 AS amount_vnd, customer_name
        FROM issued ORDER BY issued_at, invoice_no LIMIT $6) x) AS issued,
    (SELECT count(*) FROM paid)::int AS paid_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM paid)::float8 AS paid_total,
    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT invoice_no, amount_vnd::float8 AS amount_vnd, customer_name,
            ends_on::text AS ends_on, (ends_on > period_ends_on) AS extended
        FROM paid ORDER BY paid_at, invoice_no LIMIT $6) x) AS paid,
    (SELECT count(*) FROM unpaid)::int AS unpaid_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM unpaid)::float8 AS unpaid_total,
    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT invoice_no, amount_vnd::float8 AS amount_vnd, customer_name,
            to_char(due_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS due_on
        FROM unpaid ORDER BY due_at, invoice_no LIMIT $6) x) AS unpaid,
    (SELECT count(*) FROM expiring)::int AS expiring_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM expiring)::float8 AS expiring_total,
    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT customer_name, plan, ends_on::text AS ends_on, amount_vnd::float8 AS amount_vnd
        FROM expiring ORDER BY ends_on, customer_name LIMIT $6) x) AS expiring,
    (SELECT count(*) FROM unmatched)::int AS unmatched_count,
    (SELECT coalesce(sum(amount_vnd), 0) FROM unmatched)::float8 AS unmatched_total,
    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT amount_vnd::float8 AS amount_vnd, sender_name, memo
        FROM unmatched ORDER BY created_at LIMIT $6) x) AS unmatched`
