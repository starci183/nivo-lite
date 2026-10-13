import type { QuotaRow } from "./persistence/usage.rows"
import type { QuotaLevel, QuotaStatus, UsageKind } from "./usage.contracts"
import { creditsOf } from "./usage-cost.policy"

/** The soft warning starts at this share of the monthly allowance. */
export const WARN_AT = 0.8

/** Customer-facing kinds stop when ANY allowance is used up; everything else when the credits (or a legacy token budget) are. */
const CUSTOMER_FACING: ReadonlySet<UsageKind> = new Set<UsageKind>(["chat_reply", "relay"])

const ratioOf = (used: number, limit: number | null): number => (limit === null ? 0 : limit <= 0 ? 1 : used / limit)

/**
 * Credits are one pool: the allowance first, then the top-ups. The pool is the allowance (or the use, once past it) plus the top-up
 * credits still left, so the ratio reaches 1 only when the allowance is used up AND no top-up credit is left.
 */
const creditRatioOf = (used: number, limit: number | null, topup: number): number => {
    if (limit === null) return 0
    const pool = Math.max(used, limit) + topup
    return pool <= 0 ? 1 : used / pool
}

const levelOf = (exceeded: boolean, ratio: number): QuotaLevel =>
    exceeded ? "exceeded" : ratio >= WARN_AT ? "warn" : "ok"

/** Reads one row of ai_quota_status into the status with its ratios and level. */
export const quotaOf = (row: QuotaRow): QuotaStatus => {
    const creditsUsed = row.credits_used ?? creditsOf(row.cost_usd)
    const creditsLimit = row.credits_limit
    const topupBalance = Math.max(0, row.topup_balance ?? 0)
    const messagesRatio = ratioOf(row.messages_used, row.messages_limit)
    const tokensRatio = ratioOf(row.tokens_used, row.tokens_limit)
    const creditsRatio = creditRatioOf(creditsUsed, creditsLimit, topupBalance)
    const messagesExceeded = row.messages_limit !== null && messagesRatio >= 1
    const tokensExceeded = row.tokens_limit !== null && tokensRatio >= 1
    const creditsExceeded = creditsLimit !== null && creditsUsed >= creditsLimit && topupBalance <= 0
    const ratio = Math.max(messagesRatio, tokensRatio, creditsRatio)
    return {
        periodStart: row.period_start,
        messagesUsed: row.messages_used,
        tokensUsed: row.tokens_used,
        costUsd: row.cost_usd,
        messagesLimit: row.messages_limit,
        tokensLimit: row.tokens_limit,
        fallbackReply: row.fallback_reply?.trim() || null,
        creditsUsed,
        creditsLimit,
        creditsCarried: row.credits_carried ?? 0,
        topupBalance,
        messagesExceeded,
        tokensExceeded,
        creditsExceeded,
        ratio,
        level: levelOf(messagesExceeded || tokensExceeded || creditsExceeded, ratio),
    }
}

/** Whether a model call of this kind must NOT be made: customer-facing kinds stop at any allowance, the rest at the tokens or credits. */
export const stopsCall = (status: QuotaStatus, kind: UsageKind): boolean =>
    CUSTOMER_FACING.has(kind) ? status.level === "exceeded" : status.tokensExceeded || status.creditsExceeded
