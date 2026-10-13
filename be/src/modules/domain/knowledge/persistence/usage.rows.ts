/** The row public.ai_quota_status answers; bigint and numeric columns arrive as text from PostgreSQL. */
export interface QuotaStatusRow {
    /** The first day of the month. */
    readonly period_start: string
    /** Customer replies this month. */
    readonly messages_used: number | string
    /** Tokens this month. */
    readonly tokens_used: number | string
    /** Cost this month in US dollars. */
    readonly cost_usd: number | string
    /** The reply allowance, or null. */
    readonly messages_limit: number | string | null
    /** The token allowance, or null. */
    readonly tokens_limit: number | string | null
    /** Credits used this month, when the function reports them. */
    readonly credits_used: number | string | null
    /** The credit allowance, or null. */
    readonly credits_limit: number | string | null
    /** Credits topped up and not yet used, when the function reports them. */
    readonly topup_balance: number | string | null
}

/** Whether a notice was posted by this call. */
export interface NoticePostedRow {
    /** True when this call posted the notice, false when it had been sent before. */
    readonly posted: boolean
}
