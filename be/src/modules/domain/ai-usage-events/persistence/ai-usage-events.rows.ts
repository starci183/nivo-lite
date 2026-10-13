/** One row of ai_quota_status; numbers are cast to float8 in SQL so the driver answers numbers. */
export interface QuotaRow {
    /** First day of the month, YYYY-MM-DD. */
    readonly period_start: string
    /** Customer replies this month. */
    readonly messages_used: number
    /** Model tokens this month. */
    readonly tokens_used: number
    /** Model cost this month in USD. */
    readonly cost_usd: number
    /** The message allowance; null is unlimited. */
    readonly messages_limit: number | null
    /** The token allowance; null is unlimited. */
    readonly tokens_limit: number | null
    /** The workspace's own fallback reply, or null. */
    readonly fallback_reply: string | null
    /** Credits spent this month, or null when the function does not report it. */
    readonly credits_used: number | null
    /** The credit allowance; null is unlimited. */
    readonly credits_limit: number | null
    /** Credits carried over, or null. */
    readonly credits_carried: number | null
    /** Top-up credits left, or null. */
    readonly topup_balance: number | null
}
