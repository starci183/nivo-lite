import type { Database } from "../../../../../../../supabase/types/database.types"

type Functions = Database["public"]["Functions"]

/** The soft warning starts at this share of the monthly allowance. */
export const WARN_AT = 0.8

/**
 * Credits per USD of model cost: 1 credit sells for 0.01 USD (100 per USD) and the token cost is at most 40% of the sale
 * (x 2.5). Mirrors round(cost_usd * 250, 2) in ai_quota_status.
 */
const CREDITS_PER_USD = 250

/** Credits a model cost spends (two decimals, like the database). */
const creditsOf = (costUsd: number): number => Math.round(costUsd * CREDITS_PER_USD * 100) / 100

/** A top-up pack as sold. */
export interface CreditPack {
    readonly code: string
    readonly credits: number
    readonly price_vnd: number
    readonly sort: number
}

/** One top-up lot of a workspace. */
export interface TopupLot {
    readonly credits: number
    readonly price_vnd: number
    readonly purchased_at: string
    readonly expires_at: string
    readonly credits_remaining: number
}

/** This month's use against the allowance. */
export interface QuotaSnapshot {
    readonly periodStart: string
    readonly messagesUsed: number
    readonly tokensUsed: number
    readonly costUsd: number
    readonly messagesLimit: number | null
    readonly tokensLimit: number | null
    readonly fallbackReply: string | null
    readonly creditsUsed: number
    /** This month's allowance including the credits carried over; null is unlimited. */
    readonly creditsLimit: number | null
    readonly creditsCarried: number
    /** Top-up credits still spendable. */
    readonly topupBalance: number
    readonly messagesExceeded: boolean
    readonly tokensExceeded: boolean
    readonly creditsExceeded: boolean
    readonly ratio: number
    readonly level: "ok" | "warn" | "exceeded"
}

/** One day and module of the usage rollup. */
export interface DailyModuleUsage {
    readonly day: string
    readonly module: string
    readonly calls: number
    readonly tokens: number
    readonly cost_usd: number
}

/** The use of one module this month. */
export interface ModuleUsage {
    readonly module: string
    readonly calls: number
    readonly tokens: number
    readonly costUsd: number
    readonly credits: number
}

/** The use of one day this month. */
export interface DailyUsage {
    readonly day: string
    readonly tokens: number
    readonly credits: number
}

/** This month's figures for the billing card. */
export interface UsageSummary {
    readonly status: QuotaSnapshot | null
    readonly byModule: ReadonlyArray<ModuleUsage>
    readonly daily: ReadonlyArray<DailyUsage>
}

const ratioOf = (used: number, limit: number | null): number => {
    if (limit === null) return 0
    return limit <= 0 ? 1 : used / limit
}

/** Credits are one pool: the allowance first, then the top-ups; the ratio reaches 1 only when both are used up. */
const creditRatioOf = (used: number, limit: number | null, topup: number): number => {
    if (limit === null) return 0
    const pool = Math.max(used, limit) + topup
    return pool <= 0 ? 1 : used / pool
}

const levelOf = (exceeded: boolean, ratio: number): QuotaSnapshot["level"] => {
    if (exceeded) return "exceeded"
    return ratio >= WARN_AT ? "warn" : "ok"
}

const numberOrNull = (value: number | string | null): number | null => (value === null ? null : Number(value))

/** Reads one row of usage_quota_status into the status with its ratios and level. */
export const toQuotaStatus = (row: Functions["usage_quota_status"]["Returns"][number]): QuotaSnapshot => {
    const costUsd = Number(row.cost_usd)
    const messagesUsed = Number(row.messages_used)
    const tokensUsed = Number(row.tokens_used)
    const messagesLimit = numberOrNull(row.messages_limit)
    const tokensLimit = numberOrNull(row.tokens_limit)
    const creditsUsed = row.credits_used === null ? creditsOf(costUsd) : Number(row.credits_used)
    const creditsLimit = numberOrNull(row.credits_limit)
    const topupBalance = Math.max(0, Number(row.topup_balance ?? 0))
    const messagesRatio = ratioOf(messagesUsed, messagesLimit)
    const tokensRatio = ratioOf(tokensUsed, tokensLimit)
    const creditsRatio = creditRatioOf(creditsUsed, creditsLimit, topupBalance)
    const messagesExceeded = messagesLimit !== null && messagesRatio >= 1
    const tokensExceeded = tokensLimit !== null && tokensRatio >= 1
    const creditsExceeded = creditsLimit !== null && creditsUsed >= creditsLimit && topupBalance <= 0
    const ratio = Math.max(messagesRatio, tokensRatio, creditsRatio)
    return {
        periodStart: row.period_start,
        messagesUsed,
        tokensUsed,
        costUsd,
        messagesLimit,
        tokensLimit,
        fallbackReply: row.fallback_reply?.trim() || null,
        creditsUsed,
        creditsLimit,
        creditsCarried: Number(row.credits_carried ?? 0),
        topupBalance,
        messagesExceeded,
        tokensExceeded,
        creditsExceeded,
        ratio,
        level: levelOf(messagesExceeded || tokensExceeded || creditsExceeded, ratio),
    }
}

interface Accumulator {
    readonly calls: number
    readonly tokens: number
    readonly costUsd: number
}

const add = (total: Accumulator | undefined, row: DailyModuleUsage): Accumulator => ({
    calls: (total?.calls ?? 0) + row.calls,
    tokens: (total?.tokens ?? 0) + row.tokens,
    costUsd: (total?.costUsd ?? 0) + row.cost_usd,
})

/** Groups the daily rollup rows by module (costliest first) and by day (in order). */
export const toUsageSummary = (status: QuotaSnapshot | null, rows: ReadonlyArray<DailyModuleUsage>): UsageSummary => {
    const modules = new Map<string, Accumulator>()
    const days = new Map<string, Accumulator>()
    for (const row of rows) {
        modules.set(row.module, add(modules.get(row.module), row))
        days.set(row.day, add(days.get(row.day), row))
    }
    return {
        status,
        byModule: [...modules.entries()]
            .map(([module, total]) => ({ module, ...total, credits: creditsOf(total.costUsd) }))
            .sort((left, right) => right.credits - left.credits),
        daily: [...days.entries()].map(([day, total]) => ({
            day,
            tokens: total.tokens,
            credits: creditsOf(total.costUsd),
        })),
    }
}
