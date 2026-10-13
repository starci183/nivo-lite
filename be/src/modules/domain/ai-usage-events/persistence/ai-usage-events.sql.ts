import { sql } from "@modules/platform/database"

/** Books one model call ($1 workspace, $2 kind, $3 module, $4 model, $5 prompt tokens, $6 completion tokens, $7 cost USD, $8 estimated). */
export const INSERT_USAGE_EVENT = sql`INSERT INTO public.ai_usage_events (workspace_id, kind, module, model, prompt_tokens, completion_tokens, cost_usd, estimated)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

/** This month's use of a workspace against its allowance ($1 workspace). */
export const SELECT_QUOTA_STATUS = sql`SELECT to_char(period_start, 'YYYY-MM-DD') AS period_start, messages_used::float8 AS messages_used,
    tokens_used::float8 AS tokens_used, cost_usd::float8 AS cost_usd, messages_limit::float8 AS messages_limit,
    tokens_limit::float8 AS tokens_limit, fallback_reply, credits_used::float8 AS credits_used, credits_limit::float8 AS credits_limit,
    credits_carried::float8 AS credits_carried, topup_balance::float8 AS topup_balance
FROM public.ai_quota_status($1)
LIMIT 1`

/** Tells the workspace once per month and level that its allowance is near or used up ($1 workspace, $2 period, $3 level, $4 body). */
export const POST_USAGE_NOTICE = sql`SELECT public.usage_notice_post($1, $2::date, $3, $4) AS posted`
