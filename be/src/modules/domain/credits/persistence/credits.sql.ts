import { sql } from "@modules/platform/database"

/** The packs on sale in display order. */
export const SELECT_ACTIVE_PACKS = sql`SELECT code, credits::float8 AS credits, price_vnd::float8 AS price_vnd, sort
FROM public.credit_packs
WHERE active
ORDER BY sort
LIMIT 50`
