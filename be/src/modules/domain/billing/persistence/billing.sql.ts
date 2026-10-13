import { sql } from "@modules/platform/database"

/** The active plans of the catalogue in display order. */
export const SELECT_ACTIVE_PLANS = sql`SELECT code, name_vi, name_en, price_vnd::float8 AS price_vnd, period, seats, features, sort,
    ai_credits_per_month::float8 AS ai_credits_per_month, is_custom
FROM public.plans
WHERE active
ORDER BY sort
LIMIT 100`

/** One active plan by its code ($1). */
export const SELECT_PLAN = sql`SELECT code, name_vi, name_en, price_vnd::float8 AS price_vnd, period, seats, features, sort,
    ai_credits_per_month::float8 AS ai_credits_per_month, is_custom
FROM public.plans
WHERE code = $1 AND active
LIMIT 1`

/** The caller's active billing workspaces, newest first ($1 user). */
export const SELECT_BILLING_WORKSPACES = sql`SELECT w.id, w.name, w.status, w.plan_code, w.paid_until, m.role
FROM public.workspace_members m
JOIN public.workspaces w ON w.id = m.workspace_id
WHERE m.user_id = $1 AND m.status = 'active'
ORDER BY w.created_at DESC
LIMIT 200`

/** One caller's active billing workspace ($1 user, $2 workspace). */
export const SELECT_BILLING_WORKSPACE = sql`SELECT w.id, w.name, w.status, w.plan_code, w.paid_until, m.role
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
export const SELECT_WORKSPACE_BILLING = sql`SELECT status, plan_code, paid_until
FROM public.workspaces
WHERE id = $1
LIMIT 1`
