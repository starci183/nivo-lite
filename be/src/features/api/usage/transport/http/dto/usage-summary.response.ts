/** Where the month stands against the allowance. */
export class QuotaStatusResponse {
    /** First day of the month, YYYY-MM-DD. */
    periodStart!: string
    /** Customer replies this month. */
    messagesUsed!: number
    /** Model tokens this month. */
    tokensUsed!: number
    /** Model cost this month in USD. */
    costUsd!: number
    /** The message allowance; null is unlimited. */
    messagesLimit!: number | null
    /** The token allowance; null is unlimited. */
    tokensLimit!: number | null
    /** The workspace's own fallback reply, or null. */
    fallbackReply!: string | null
    /** Credits spent this month. */
    creditsUsed!: number
    /** This month's credit allowance; null is unlimited. */
    creditsLimit!: number | null
    /** Credits carried over from last month. */
    creditsCarried!: number
    /** Top-up credits still spendable. */
    topupBalance!: number
    /** The message allowance is used up. */
    messagesExceeded!: boolean
    /** The token allowance is used up. */
    tokensExceeded!: boolean
    /** The credits are used up. */
    creditsExceeded!: boolean
    /** The largest used/allowance ratio. */
    ratio!: number
    /** `ok`, `warn` or `exceeded`. */
    level!: string
}

/** The use of one module this month. */
export class ModuleUsageResponse {
    /** The module. */
    module!: string
    /** Model calls. */
    calls!: number
    /** Tokens. */
    tokens!: number
    /** Cost in USD. */
    costUsd!: number
    /** Credits spent. */
    credits!: number
}

/** The use of one day this month. */
export class DailyUsageResponse {
    /** The day, YYYY-MM-DD. */
    day!: string
    /** Tokens. */
    tokens!: number
    /** Credits spent. */
    credits!: number
}

/** This month's AI usage of a workspace. */
export class UsageSummaryResponse {
    /** The allowance status, or null when it cannot be read. */
    status!: QuotaStatusResponse | null
    /** Use by module, the costliest first. */
    byModule!: ReadonlyArray<ModuleUsageResponse>
    /** Use by day. */
    daily!: ReadonlyArray<DailyUsageResponse>
}
