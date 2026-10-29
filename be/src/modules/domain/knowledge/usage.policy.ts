import { creditsOf } from "@modules/domain/ai-usage-events"
import type { AiUsage } from "@modules/integrations/ai"
import type { QuotaStatus, UsageKind } from "./knowledge.contracts"
import type { QuotaStatusRow } from "./persistence/usage.rows"

/** The share of the allowance at which the owner is warned. */
const WARN_AT = 0.8

/** The price per million tokens of the models whose provider reports no cost. */
interface Price {
    /** The text of the model name this price applies to. */
    readonly match: string
    /** US dollars per million prompt tokens. */
    readonly in: number
    /** US dollars per million completion tokens. */
    readonly out: number
}

const PRICES: ReadonlyArray<Price> = [
    { match: "deepseek", in: 0.14, out: 0.28 },
    { match: "qwen3-embedding", in: 0.01, out: 0 },
    { match: "text-embedding-3-small", in: 0.02, out: 0 },
    { match: "text-embedding-3-large", in: 0.13, out: 0 },
]

const DEFAULT_PRICE: Price = { match: "", in: 0.3, out: 1.2 }

/** Kinds whose replies customers read: they are held back as soon as the allowance is exceeded. */
const CUSTOMER_FACING: ReadonlySet<UsageKind> = new Set<UsageKind>(["chat_reply", "relay"])

/** The tokens and cost of one call, as they are recorded. */
export interface UsageFigures {
    /** Prompt tokens. */
    readonly promptTokens: number
    /** Completion tokens. */
    readonly completionTokens: number
    /** Cost in US dollars. */
    readonly costUsd: number
    /** True when the provider reported no usage and the tokens were estimated. */
    readonly estimated: boolean
}

/** What the figures of a call are made from. */
export interface UsageInputs {
    /** The model, to price the call when the provider reports no cost. */
    readonly model: string
    /** What the provider reported, or null. */
    readonly usage: AiUsage | null
    /** The characters sent. */
    readonly promptChars: number
    /** The characters received. */
    readonly completionChars: number
}

/** The cost in US dollars of a call to a model by its list price. */
export const priceOf = (model: string, promptTokens: number, completionTokens: number): number => {
    const price = PRICES.find((entry) => model.toLowerCase().includes(entry.match)) ?? DEFAULT_PRICE
    return (promptTokens * price.in + completionTokens * price.out) / 1_000_000
}

/** About one token per three characters, at least one. */
export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 3))

/** The two sides of the tokens a provider reported. */
interface ReportedTokens {
    /** Prompt tokens. */
    readonly prompt: number
    /** Completion tokens. */
    readonly completion: number
}

/** The tokens a provider reported: a missing side is derived from the total. */
const reportedTokens = (usage: AiUsage): ReportedTokens => {
    const total = usage.totalTokens ?? 0
    const prompt = usage.promptTokens ?? Math.max(0, total - (usage.completionTokens ?? 0))
    return { prompt, completion: usage.completionTokens ?? Math.max(0, total - prompt) }
}

/** The figures to record for a call: what the provider reported, else an estimate from the characters. */
export const figuresOf = (inputs: UsageInputs): UsageFigures => {
    const usage = inputs.usage
    const estimated =
        usage === null || (usage.promptTokens === null && usage.completionTokens === null && usage.totalTokens === null)
    const reported = usage === null ? { prompt: 0, completion: 0 } : reportedTokens(usage)
    const promptTokens = estimated ? estimateTokens(inputs.promptChars) : reported.prompt
    const guessed = inputs.completionChars > 0 ? estimateTokens(inputs.completionChars) : 0
    const completionTokens = estimated ? guessed : reported.completion
    const costUsd = usage?.costUsd ?? priceOf(inputs.model, promptTokens, completionTokens)
    return { promptTokens, completionTokens, costUsd, estimated }
}

const numberOrNull = (value: number | string | null): number | null => (value === null ? null : Number(value))

const numberOr = (value: number | string | null, fallback: number): number =>
    value === null ? fallback : Number(value)

const ratioOf = (used: number, limit: number | null): number => {
    if (limit === null) return 0
    return limit <= 0 ? 1 : used / limit
}

const creditRatioOf = (used: number, limit: number | null, topup: number): number => {
    if (limit === null) return 0
    const pool = Math.max(used, limit) + topup
    return pool <= 0 ? 1 : used / pool
}

/** ok, warn (80% used) or exceeded. */
const levelOf = (exceeded: boolean, ratio: number): QuotaStatus["level"] => {
    if (exceeded) return "exceeded"
    return ratio >= WARN_AT ? "warn" : "ok"
}

/** This month's use against the allowance, from the row the database answers. */
export const quotaStatusOf = (row: QuotaStatusRow): QuotaStatus => {
    const messagesUsed = Number(row.messages_used)
    const tokensUsed = Number(row.tokens_used)
    const messagesLimit = numberOrNull(row.messages_limit)
    const tokensLimit = numberOrNull(row.tokens_limit)
    const creditsUsed = numberOr(row.credits_used, creditsOf(Number(row.cost_usd)))
    const creditsLimit = numberOrNull(row.credits_limit)
    const topupBalance = Math.max(0, numberOr(row.topup_balance, 0))
    const messagesExceeded = messagesLimit !== null && ratioOf(messagesUsed, messagesLimit) >= 1
    const tokensExceeded = tokensLimit !== null && ratioOf(tokensUsed, tokensLimit) >= 1
    const creditsExceeded = creditsLimit !== null && creditsUsed >= creditsLimit && topupBalance <= 0
    const ratio = Math.max(
        ratioOf(messagesUsed, messagesLimit),
        ratioOf(tokensUsed, tokensLimit),
        creditRatioOf(creditsUsed, creditsLimit, topupBalance),
    )
    const exceeded = messagesExceeded || tokensExceeded || creditsExceeded
    return {
        periodStart: row.period_start,
        messagesUsed,
        tokensUsed,
        messagesLimit,
        tokensLimit,
        creditsUsed,
        creditsLimit,
        topupBalance,
        messagesExceeded,
        tokensExceeded,
        creditsExceeded,
        ratio,
        level: levelOf(exceeded, ratio),
    }
}

/**
 * Whether a model call of `kind` must NOT be made. Guide calls never block and a small (non-bulk) embedding never blocks; a call
 * customers read is held back once the allowance is exceeded, every other call once the tokens or the credits are used up.
 */
export const isBlocked = (kind: UsageKind, status: QuotaStatus, bulk: boolean): boolean => {
    if (kind === "guide" || (kind === "embedding" && !bulk)) return false
    return CUSTOMER_FACING.has(kind) ? status.level === "exceeded" : status.tokensExceeded || status.creditsExceeded
}
