import type { ProviderUsage, UsageFigures, UsageInput } from "./usage.contracts"

/**
 * Credits per USD of model cost: 1 credit sells for 0.01 USD (100 per USD) and the token cost is at most 40% of the sale
 * (x 2.5), a 60% gross margin on tokens at par. Mirrors round(cost_usd * 250, 2) in ai_quota_status.
 */
export const CREDITS_PER_USD = 250

/** USD per 1M tokens, used only when the provider returns no cost. Approximate list prices, not a contract. */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number }> = [
    { match: "deepseek", in: 0.14, out: 0.28 },
    { match: "qwen3-embedding", in: 0.01, out: 0 },
    { match: "text-embedding-3-small", in: 0.02, out: 0 },
    { match: "text-embedding-3-large", in: 0.13, out: 0 },
]
const DEFAULT_PRICE = { in: 0.3, out: 1.2 }

/** Cost in USD from the price table. */
export const priceOf = (model: string, promptTokens: number, completionTokens: number): number => {
    const price = PRICES.find((entry) => model.toLowerCase().includes(entry.match)) ?? DEFAULT_PRICE
    return (promptTokens * price.in + completionTokens * price.out) / 1_000_000
}

/** Rough token count when the provider sent none (Vietnamese is about 3 characters per token). */
export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 3))

/** Credits a model cost spends (two decimals, like the database). */
export const creditsOf = (costUsd: number): number => Math.round(costUsd * CREDITS_PER_USD * 100) / 100

const countOf = (value: number | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null

/** The tokens and cost a call is booked with: the provider's own figures when it sent them, else an estimate from the characters. */
export const figuresOf = (
    input: Pick<UsageInput, "model" | "promptChars" | "completionChars">,
    usage: ProviderUsage | null,
): UsageFigures => {
    const prompt = countOf(usage?.prompt_tokens)
    const completion = countOf(usage?.completion_tokens)
    const total = countOf(usage?.total_tokens)
    const estimated = prompt === null && completion === null && total === null
    const promptTokens = estimated
        ? estimateTokens(input.promptChars)
        : (prompt ?? Math.max(0, (total ?? 0) - (completion ?? 0)))
    const completionTokens = estimated
        ? input.completionChars > 0
            ? estimateTokens(input.completionChars)
            : 0
        : (completion ?? Math.max(0, (total ?? 0) - promptTokens))
    const cost = countOf(usage?.cost) ?? priceOf(input.model, promptTokens, completionTokens)
    return {
        promptTokens: Math.round(promptTokens),
        completionTokens: Math.round(completionTokens),
        costUsd: Number(cost.toFixed(8)),
        estimated,
    }
}
