import { sql } from "@modules/platform/database"

/** One order of the workspace ($1 workspace, $2 order). */
export const FIND_ORDER = sql`SELECT id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd::float8 AS amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code
FROM public.orders WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The number and items of several orders ($1 workspace, $2 order ids). */
export const FIND_ORDER_LABELS = sql`SELECT id, order_no, items
FROM public.orders WHERE workspace_id = $1::uuid AND id = ANY($2::uuid[])
LIMIT 200`

/** How many orders carry a number that starts with the prefix ($1 workspace, $2 prefix). */
export const COUNT_ORDERS_WITH_PREFIX = sql`SELECT count(*)::int AS n
FROM public.orders WHERE workspace_id = $1::uuid AND order_no LIKE $2 || '%'`

/** Inserts a draft order; no row when the number is taken ($1 workspace, $2 lead, $3 input, $4 number, $5 items, $6 amount, $7 origin). */
export const INSERT_ORDER_DRAFT = sql`INSERT INTO public.orders (workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd, status, origin)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::bigint, 'draft', $7)
ON CONFLICT (workspace_id, order_no) DO NOTHING
RETURNING id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd::float8 AS amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code`

/** Confirms a draft order and answers it; no row when it is not a draft ($1 workspace, $2 order, $3 amount, $4 items, $5 confirmer, $6 time). */
export const CONFIRM_ORDER = sql`WITH changed AS (
    UPDATE public.orders
    SET status = 'confirmed', amount_vnd = $3::bigint, items = $4, confirmed_by = $5, confirmed_at = $6::timestamptz
    WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'draft'
    RETURNING id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code
)
SELECT id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd::float8 AS amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code FROM changed`

/** Cancels a draft order and answers it; no row when it is not a draft ($1 workspace, $2 order). */
export const CANCEL_ORDER = sql`WITH changed AS (
    UPDATE public.orders SET status = 'cancelled'
    WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'draft'
    RETURNING id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code
)
SELECT id, workspace_id, lead_id, inbound_event_id, order_no, items, amount_vnd::float8 AS amount_vnd, status, origin, confirmed_by, confirmed_at, created_at, shipped_at, carrier, tracking_code FROM changed`

/** Moves an order that is past its draft to a later status ($1 workspace, $2 order, $3 status). */
export const SET_ORDER_STATUS = sql`UPDATE public.orders SET status = $3
WHERE workspace_id = $1::uuid AND id = $2::uuid AND status <> 'cancelled'`

/** The newest workspace orders and their customer labels ($1 workspace, $2 bounded limit). */
export const LIST_ORDERS = sql`SELECT o.id, o.workspace_id, o.lead_id, o.inbound_event_id, o.order_no, o.items,
    o.amount_vnd::float8 AS amount_vnd, o.status, o.origin, o.confirmed_by,
    to_char(o.confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS confirmed_at,
    to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
    to_char(o.shipped_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS shipped_at,
    o.carrier, o.tracking_code,
    l.contact_name, l.company
FROM public.orders o
LEFT JOIN public.leads l ON l.id = o.lead_id AND l.workspace_id = o.workspace_id
WHERE o.workspace_id = $1::uuid ORDER BY o.created_at DESC LIMIT $2`
