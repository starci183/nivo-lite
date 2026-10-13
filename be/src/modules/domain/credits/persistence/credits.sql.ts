import { sql } from "@modules/platform/database"

/** The packs on sale in display order. */
export const SELECT_ACTIVE_PACKS = sql`SELECT code, credits::float8 AS credits, price_vnd::float8 AS price_vnd, sort
FROM public.credit_packs
WHERE active
ORDER BY sort
LIMIT 50`

/** The top-up lots of a workspace, newest first ($1 workspace). */
export const SELECT_TOPUP_LOTS = sql`SELECT credits::float8 AS credits, price_vnd::float8 AS price_vnd, purchased_at, expires_at,
    credits_remaining::float8 AS credits_remaining
FROM public.credit_topups
WHERE workspace_id = $1
ORDER BY purchased_at DESC
LIMIT 200`
