import { sql } from "@modules/platform/database"

/**
 * Writes one pending payment order and answers it; a collision on the unique order code answers no row, so the caller draws a
 * new code ($1 workspace, $2 creator, $3 plan, $4 amount, $5 order code, $6 kind, $7 pack, $8 detail).
 */
export const INSERT_PAYMENT_ORDER = sql`INSERT INTO public.payment_orders (workspace_id, created_by, plan_code, amount_vnd, order_code, kind, pack_code, detail)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
ON CONFLICT (order_code) DO NOTHING
RETURNING id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail`

/** The newest pending, unexpired top-up order of a workspace for one pack and amount ($1 workspace, $2 pack, $3 amount, $4 now). */
export const SELECT_OPEN_TOPUP_ORDER = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1 AND kind = 'topup' AND status = 'pending' AND pack_code = $2 AND amount_vnd = $3 AND expires_at > $4
ORDER BY created_at DESC
LIMIT 1`

/** The newest pending, unexpired add-on pack order of a workspace for one pack and amount ($1 workspace, $2 credits, $3 amount, $4 now). */
export const SELECT_OPEN_CREDIT_PACK_ORDER = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1 AND kind = 'credit_pack' AND status = 'pending' AND detail ->> 'credits' = $2 AND amount_vnd = $3 AND expires_at > $4
ORDER BY created_at DESC
LIMIT 1`

/** The newest payment orders of a workspace ($1 workspace). */
export const SELECT_PAYMENT_ORDERS = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 50`

/** One payment order, scoped to its workspace ($1 workspace, $2 order). */
export const SELECT_PAYMENT_ORDER = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** The newest pending unexpired plan order ($1 workspace, $2 now). */
export const SELECT_OPEN_PLAN_ORDER = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1 AND kind = 'plan' AND status = 'pending' AND expires_at > $2
ORDER BY created_at DESC
LIMIT 1`

/** The newest pending, unexpired upgrade order of a workspace for one target plan and amount ($1 workspace, $2 plan, $3 amount, $4 now). */
export const SELECT_OPEN_UPGRADE_ORDER = sql`SELECT id, workspace_id, plan_code, amount_vnd::float8 AS amount_vnd, order_code, status, expires_at, paid_at, created_at, kind, pack_code, detail
FROM public.payment_orders
WHERE workspace_id = $1 AND kind = 'upgrade' AND status = 'pending' AND plan_code = $2 AND amount_vnd = $3 AND expires_at > $4
ORDER BY created_at DESC
LIMIT 1`
