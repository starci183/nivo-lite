/** A nullable numeric value returned by the SQL driver. */
type NullableNumeric = string | number | null

// The shapes the platform-admin statements answer; timestamps and bigints may arrive as text or as Date and number.

/** The workspace columns the list and the detail read. */
export interface WorkspaceRow {
    /** The id. */
    readonly id: string
    /** The owner id. */
    readonly owner_id: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: string
    /** The plan code. */
    readonly plan_code: string | null
    /** The paid until. */
    readonly paid_until: string | null
    /** The created at. */
    readonly created_at: string
}

/** One row of admin_workspace_stats(). */
export interface StatsRow {
    /** The workspace id. */
    readonly workspace_id: string
    /** The members. */
    readonly members: number
    /** The last customer message at. */
    readonly last_customer_message_at: string | null
    /** The messages 7d. */
    readonly messages_7d: number
    /** The open decisions. */
    readonly open_decisions: number
}

/** The installation columns of the list. */
export interface ModuleBadgeRow {
    /** The workspace id. */
    readonly workspace_id: string
    /** The module key. */
    readonly module_key: string
    /** The status. */
    readonly status: string
    /** The live enabled. */
    readonly live_enabled: boolean
}

/** The connection columns of the list. */
export interface ConnectionBadgeRow {
    /** The workspace id. */
    readonly workspace_id: string
    /** The provider. */
    readonly provider: string
    /** The status. */
    readonly status: string
    /** The environment. */
    readonly environment: string | null
    /** The last event at. */
    readonly last_event_at: string | null
    /** The created at. */
    readonly created_at: string
}

/** A row that only names a workspace; platform-level rows name none. */
export interface WorkspaceRefRow {
    /** The workspace id. */
    readonly workspace_id: string | null
}

/** One Auth user's email. */
export interface UserEmailRow {
    /** The id. */
    readonly id: string
    /** The email. */
    readonly email: string
}

/** The member columns of the detail. */
export interface MemberRow {
    /** The user id. */
    readonly user_id: string
    /** The role. */
    readonly role: string
    /** The display name. */
    readonly display_name: string
    /** The status. */
    readonly status: string
    /** The created at. */
    readonly created_at: string
}

/** The invitation columns of the detail. */
export interface InviteRow {
    /** The id. */
    readonly id: string
    /** The email. */
    readonly email: string
    /** The role. */
    readonly role: string
    /** The created at. */
    readonly created_at: string
    /** The expires at. */
    readonly expires_at: string
}

/** The order columns of the detail; the amount is a bigint and may arrive as text. */
export interface OrderRow {
    /** The id. */
    readonly id: string
    /** The order code. */
    readonly order_code: string
    /** The plan code. */
    readonly plan_code: string
    /** The amount vnd. */
    readonly amount_vnd: string | number
    /** The status. */
    readonly status: string
    /** The created at. */
    readonly created_at: string
    /** The paid at. */
    readonly paid_at: string | null
}

/** The billing-event columns of the detail. */
export interface BillingEventRow {
    /** The id. */
    readonly id: string
    /** The kind. */
    readonly kind: string
    /** The created at. */
    readonly created_at: string
}

/** The installation columns of the detail. */
export interface InstallRow {
    /** The id. */
    readonly id: string
    /** The module key. */
    readonly module_key: string
    /** The status. */
    readonly status: string
    /** The operating mode. */
    readonly operating_mode: string
    /** The live enabled. */
    readonly live_enabled: boolean
    /** The active context version id. */
    readonly active_context_version_id: string | null
    /** The processor. */
    readonly processor: string | null
}

/** The context-version columns of the detail. */
export interface ContextVersionRow {
    /** The id. */
    readonly id: string
    /** The version. */
    readonly version: number
    /** The applied at. */
    readonly applied_at: string
}

/** The sync columns of the detail. */
export interface AgentSyncRow {
    /** The installation id. */
    readonly installation_id: string
    /** The agent id. */
    readonly agent_id: string
    /** The context version. */
    readonly context_version: number | null
    /** The checked at. */
    readonly checked_at: string
    /** The status. */
    readonly status: string
    /** The error. */
    readonly error: string | null
}

/** The connection columns of the detail. */
export interface ConnectionRow {
    /** The id. */
    readonly id: string
    /** The provider. */
    readonly provider: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: string
    /** The environment. */
    readonly environment: string | null
    /** The last event at. */
    readonly last_event_at: string | null
    /** The last error. */
    readonly last_error: string | null
    /** The created at. */
    readonly created_at: string
}

/** The error columns of the detail. */
export interface WorkspaceErrorRow {
    /** The id. */
    readonly id: string
    /** The scope. */
    readonly scope: string
    /** The message. */
    readonly message: string
    /** The created at. */
    readonly created_at: string
}

/** The knowledge-source columns of the detail. */
export interface KnowledgeRow {
    /** The kind. */
    readonly kind: string
    /** The status. */
    readonly status: string
}

/** The SePay columns of the detail; the amounts are bigints and may arrive as text. */
export interface TransferRow {
    /** The sepay id. */
    readonly sepay_id: string | number
    /** The transfer amount. */
    readonly transfer_amount: NullableNumeric
    /** The content. */
    readonly content: string | null
    /** The status. */
    readonly status: string
    /** The received at. */
    readonly received_at: string
}

/** The activity columns of one admin_workspace_stats() row. */
export interface ActivityRow {
    /** The messages 7d. */
    readonly messages_7d: number
    /** The last customer message at. */
    readonly last_customer_message_at: string | null
    /** The open decisions. */
    readonly open_decisions: number
}

/** One ai_quota_status() row; numerics may arrive as text. */
export interface QuotaRow {
    /** The credits used. */
    readonly credits_used: NullableNumeric
    /** The credits limit. */
    readonly credits_limit: NullableNumeric
    /** The cost usd. */
    readonly cost_usd: string | number
}

/** The own allowance row. */
export interface QuotaOverrideRow {
    /** The credits limit. */
    readonly credits_limit: NullableNumeric
}

/** One sign-up day. */
export interface SignupRow {
    /** The day. */
    readonly day: string
    /** The signups. */
    readonly signups: number
}

/** One platform SePay transfer. */
export interface RecentTransferRow {
    /** The status. */
    readonly status: string
    /** The transfer amount. */
    readonly transfer_amount: NullableNumeric
    /** The content. */
    readonly content: string | null
    /** The received at. */
    readonly received_at: string
}

/** One platform billing event. */
export interface RecentBillingEventRow {
    /** The id. */
    readonly id: string
    /** The workspace id. */
    readonly workspace_id: string | null
    /** The kind. */
    readonly kind: string
    /** The created at. */
    readonly created_at: string
}

/** One platform error. */
export interface RecentErrorRow {
    /** The id. */
    readonly id: string
    /** The scope. */
    readonly scope: string
    /** The message. */
    readonly message: string
    /** The workspace id. */
    readonly workspace_id: string | null
    /** The created at. */
    readonly created_at: string
}

/** A count by key. */
export interface CountRow {
    /** The key. */
    readonly key: string
    /** The count. */
    readonly count: number
}

/** A workspace id and name. */
export interface WorkspaceNameRow {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
}
