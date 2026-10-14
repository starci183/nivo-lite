import { sql } from "@modules/platform/database"

/** The plans on sale in display order: active and listed (a plan only its old subscribers keep is not offered). */
export const SELECT_ACTIVE_PLANS = sql`SELECT code, name_vi, name_en, price_vnd::float8 AS price_vnd, period, seats, features, sort,
    ai_credits_per_month::float8 AS ai_credits_per_month, is_custom, price_annual_vnd::float8 AS price_annual_vnd, annual_discount_pct,
    promo_price_vnd::float8 AS promo_price_vnd, promo_months, storage_gb, individual, per_seat, listed
FROM public.plans
WHERE active AND listed
ORDER BY sort
LIMIT 100`

/** The usage tiers of every plan, smallest allowance first. */
export const SELECT_PLAN_TIERS = sql`SELECT plan_code, credits_per_month::float8 AS credits_per_month, price_vnd::float8 AS price_vnd, per_seat
FROM public.plan_usage_tiers
ORDER BY plan_code, sort
LIMIT 500`

/** One active plan by its code ($1). */
export const SELECT_PLAN = sql`SELECT code, name_vi, name_en, price_vnd::float8 AS price_vnd, period, seats, features, sort,
    ai_credits_per_month::float8 AS ai_credits_per_month, is_custom, price_annual_vnd::float8 AS price_annual_vnd, annual_discount_pct,
    promo_price_vnd::float8 AS promo_price_vnd, promo_months, storage_gb, individual, per_seat, listed
FROM public.plans
WHERE code = $1 AND active
LIMIT 1`

/** The caller's active billing workspaces, newest first ($1 user). */
export const SELECT_BILLING_WORKSPACES = sql`SELECT w.id, w.name, w.status, w.plan_code, w.paid_until, w.tier_credits::float8 AS tier_credits, w.seat_count,
    w.billing_cycle, w.billed_monthly_vnd::float8 AS billed_monthly_vnd, m.role
FROM public.workspace_members m
JOIN public.workspaces w ON w.id = m.workspace_id
WHERE m.user_id = $1 AND m.status = 'active'
ORDER BY w.created_at DESC
LIMIT 200`

/** One caller's active billing workspace ($1 user, $2 workspace). */
export const SELECT_BILLING_WORKSPACE = sql`SELECT w.id, w.name, w.status, w.plan_code, w.paid_until, w.tier_credits::float8 AS tier_credits, w.seat_count,
    w.billing_cycle, w.billed_monthly_vnd::float8 AS billed_monthly_vnd, m.role
FROM public.workspace_members m
JOIN public.workspaces w ON w.id = m.workspace_id
WHERE m.user_id = $1 AND w.id = $2 AND m.status = 'active'
LIMIT 1`

/** The role of an active member of a workspace ($1 workspace, $2 user). */
export const SELECT_MEMBER_ROLE = sql`SELECT role
FROM public.workspace_members
WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
LIMIT 1`

/** The billing columns of a workspace ($1). */
export const SELECT_WORKSPACE_BILLING = sql`SELECT status, plan_code, paid_until, tier_credits::float8 AS tier_credits, seat_count, billing_cycle,
    billed_monthly_vnd::float8 AS billed_monthly_vnd
FROM public.workspaces
WHERE id = $1
LIMIT 1`

/** What a workspace already paid for plan months: at full price and at the intro price ($1 workspace). */
export const SELECT_PROMO_HISTORY = sql`SELECT
    count(*) FILTER (WHERE COALESCE(detail ->> 'promo', 'false') <> 'true')::int AS full_price,
    count(*) FILTER (WHERE detail ->> 'promo' = 'true')::int AS promo
FROM public.payment_orders
WHERE workspace_id = $1 AND kind = 'plan' AND status = 'paid'`

/** Active members of a workspace ($1). */
export const SELECT_ACTIVE_MEMBER_COUNT = sql`SELECT count(*)::int AS count
FROM public.workspace_members
WHERE workspace_id = $1 AND status = 'active'`

/** Invitations of a workspace that can still be accepted ($1 workspace, $2 now). */
export const SELECT_PENDING_INVITE_COUNT = sql`SELECT count(*)::int AS count
FROM public.workspace_invites
WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > $2`

/** The bytes a workspace keeps in the knowledge and media buckets ($1). */
export const SELECT_STORAGE_BYTES = sql`SELECT public.workspace_storage_bytes($1)::float8 AS bytes`
