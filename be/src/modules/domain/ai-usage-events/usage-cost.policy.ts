import type { ProviderUsage, UsageFigures, UsageInput } from "./ai-usage-events.contracts"

/**
 * A credit is defined in dollars of token usage: 1 credit = 0.00113 USD of model token cost (= 1/885). Mirrors
 * billing_config.credit_usd_value, which ai_credit_period divides by. Derived as
 *     min revenue per included credit (49 VND = Start 490,000 / 10,000) x (1 - 0.40 target margin) / 26,000 VND per USD = 0.001131
 * so every plan keeps a 40% gross margin on token cost. The inputs (margin, exchange rate) are only documentation: change the
 * definition in billing_config and here together.
 */
export const CREDIT_USD_VALUE = 0.00113

/** USD per 1M tokens, used only when the provider returns no cost. Approximate list prices, not a contract. */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number }> = [
    { match: "deepseek-v4.1-flash", in: 0.14, out: 0.42 },
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

/** Credits a model cost spends: tokens x the model's USD price per token (costUsd) over the USD value of a credit, rounded up like the database. */
export const creditsOf = (costUsd: number): number => Math.ceil(costUsd / CREDIT_USD_VALUE)

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
    const estimatedCompletion = input.completionChars > 0 ? estimateTokens(input.completionChars) : 0
    const completionTokens = estimated ? estimatedCompletion : (completion ?? Math.max(0, (total ?? 0) - promptTokens))
    const cost = countOf(usage?.cost) ?? priceOf(input.model, promptTokens, completionTokens)
    return {
        promptTokens: Math.round(promptTokens),
        completionTokens: Math.round(completionTokens),
        costUsd: Number(cost.toFixed(8)),
        estimated,
    }
}
