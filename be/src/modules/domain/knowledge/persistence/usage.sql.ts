import { sql } from "@modules/platform/database"

/** Records one model call through the database function that owns the usage ledger ($1 workspace, $2 kind, $3 module, $4 model, $5 prompt tokens, $6 completion tokens, $7 cost in USD, $8 estimated). */
export const RECORD_USAGE_EVENT = sql`SELECT public.record_ai_usage($1, $2, $3, $4, $5, $6, $7, $8)`

/** This month's use against the allowance of a workspace ($1 workspace). */
export const SELECT_QUOTA_STATUS = sql`SELECT period_start, messages_used, tokens_used, cost_usd, messages_limit, tokens_limit, credits_used, credits_limit, topup_balance
FROM public.ai_quota_status($1) LIMIT 1`

/** Posts the owner notice of a month and level into the Office once; false when it was already sent ($1 workspace, $2 period start, $3 level, $4 text). */
export const POST_USAGE_NOTICE = sql`SELECT public.post_ai_usage_notice($1, $2, $3, $4) AS posted`
