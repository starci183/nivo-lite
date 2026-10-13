import { sql } from "@modules/platform/database"

/* ---------------------------------------------------------------- workspace list */

/** Reads the newest customer workspaces. */
export const LIST_WORKSPACES = sql`SELECT id, owner_id, name, status, plan_code, paid_until, created_at
FROM public.workspaces
ORDER BY created_at DESC
LIMIT 1000`

/** Reads the per-workspace counts the list needs (one row per workspace). */
export const LIST_WORKSPACE_STATS = sql`SELECT workspace_id, members, last_customer_message_at, messages_7d, open_decisions
FROM public.admin_workspace_stats()
LIMIT 1000`

/** Reads the agent installations of every workspace. */
export const LIST_MODULE_INSTALLS = sql`SELECT workspace_id, module_key, status, live_enabled
FROM public.module_installations
LIMIT 5000`

/** Reads every connection that is not disconnected. */
export const LIST_LIVE_CONNECTIONS = sql`SELECT workspace_id, provider, status, environment, last_event_at, created_at
FROM public.connections
WHERE status <> 'disconnected'
LIMIT 5000`

/** Reads the workspaces of the errors captured since an instant ($1). */
export const LIST_ERROR_WORKSPACES = sql`SELECT workspace_id
FROM public.app_errors
WHERE created_at >= $1 AND workspace_id IS NOT NULL
LIMIT 5000`

/** Reads the emails of Auth users ($1 ids). */
export const LIST_USER_EMAILS = sql`SELECT id, email FROM be_access.user_emails($1) LIMIT 5000`

/* ---------------------------------------------------------------- workspace detail */

/** Reads one workspace ($1 id). */
export const FIND_WORKSPACE = sql`SELECT id, owner_id, name, status, plan_code, paid_until, created_at
FROM public.workspaces
WHERE id = $1
LIMIT 1`

/** Reads the members of a workspace ($1). */
export const LIST_MEMBERS = sql`SELECT user_id, role, display_name, status, created_at
FROM public.workspace_members
WHERE workspace_id = $1
ORDER BY created_at
LIMIT 500`

/** Reads the pending invitations of a workspace ($1). */
export const LIST_PENDING_INVITES = sql`SELECT id, email, role, created_at, expires_at
FROM public.workspace_invites
WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
ORDER BY created_at DESC
LIMIT 200`

/** Reads the newest payment orders of a workspace ($1). */
export const LIST_ORDERS = sql`SELECT id, order_code, plan_code, amount_vnd, status, created_at, paid_at
FROM public.payment_orders
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 30`

/** Reads the newest billing events of a workspace ($1). */
export const LIST_BILLING_EVENTS = sql`SELECT id, kind, created_at
FROM public.billing_events
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 20`

/** Reads the agent installations of a workspace ($1). */
export const LIST_INSTALLS = sql`SELECT id, module_key, status, operating_mode, live_enabled, active_context_version_id, settings ->> 'processor' AS processor
FROM public.module_installations
WHERE workspace_id = $1
LIMIT 50`

/** Reads the context versions of a workspace ($1). */
export const LIST_CONTEXT_VERSIONS = sql`SELECT id, version, applied_at
FROM public.module_context_versions
WHERE workspace_id = $1
LIMIT 500`

/** Reads the OpenClaw sync state of a workspace's agents ($1). */
export const LIST_AGENT_SYNC = sql`SELECT installation_id, agent_id, context_version, checked_at, status, error
FROM public.openclaw_agent_sync
WHERE workspace_id = $1
LIMIT 50`

/** Reads the connections of a workspace ($1). */
export const LIST_CONNECTIONS = sql`SELECT id, provider, name, status, environment, last_event_at, last_error, created_at
FROM public.connections
WHERE workspace_id = $1
ORDER BY created_at
LIMIT 200`

/** Reads the newest captured errors of a workspace ($1). */
export const LIST_WORKSPACE_ERRORS = sql`SELECT id, scope, message, created_at
FROM public.app_errors
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 20`

/** Reads the kind and status of a workspace's knowledge sources ($1). */
export const LIST_KNOWLEDGE_SOURCES = sql`SELECT kind, status
FROM public.knowledge_sources
WHERE workspace_id = $1
LIMIT 5000`

/** Reads the SePay transfers matched to the given orders ($1 order ids). */
export const LIST_TRANSFERS = sql`SELECT sepay_id, transfer_amount, content, status, received_at
FROM public.sepay_transactions
WHERE matched_order_id = ANY($1::uuid[])
ORDER BY received_at DESC
LIMIT 30`

/** Reads the activity counts of one workspace ($1). */
export const FIND_WORKSPACE_STATS = sql`SELECT messages_7d, last_customer_message_at, open_decisions
FROM public.admin_workspace_stats()
WHERE workspace_id = $1
LIMIT 1`

/** Reads this month's quota status of a workspace ($1). */
export const FIND_QUOTA_STATUS = sql`SELECT credits_used, credits_limit, cost_usd
FROM public.ai_quota_status($1)
LIMIT 1`

/** Reads the own credit allowance of a workspace ($1). */
export const FIND_QUOTA_OVERRIDE = sql`SELECT credits_limit
FROM public.ai_quota_overrides
WHERE workspace_id = $1
LIMIT 1`

/* ---------------------------------------------------------------- platform health */

/** Reads the sign-ups of the last 14 days. */
export const LIST_SIGNUPS = sql`SELECT day::text AS day, signups
FROM public.admin_signups_per_day(14)
LIMIT 14`

/** Reads the newest SePay transfers. */
export const LIST_RECENT_TRANSFERS = sql`SELECT status, transfer_amount, content, received_at
FROM public.sepay_transactions
ORDER BY received_at DESC
LIMIT 25`

/** Reads the newest billing events. */
export const LIST_RECENT_BILLING_EVENTS = sql`SELECT id, workspace_id, kind, created_at
FROM public.billing_events
ORDER BY created_at DESC
LIMIT 25`

/** Reads the newest captured errors. */
export const LIST_RECENT_ERRORS = sql`SELECT id, scope, message, workspace_id, created_at
FROM public.app_errors
ORDER BY created_at DESC
LIMIT 50`

/** Counts the errors captured since an instant by scope ($1). */
export const LIST_ERROR_SCOPES = sql`SELECT scope AS key, (count(*))::int AS count
FROM public.app_errors
WHERE created_at >= $1
GROUP BY scope
ORDER BY count DESC, scope
LIMIT 100`

/** Reads the names of workspaces ($1 ids). */
export const LIST_WORKSPACE_NAMES = sql`SELECT id, name
FROM public.workspaces
WHERE id = ANY($1::uuid[])
LIMIT 500`
