import type { ProviderUsage, UsageFigures, UsageInput } from "./ai-usage-events.contracts"

/**
 * A credit is defined in dollars of token usage: 1 credit = 0.00113 USD of model token cost (= 1/885). Mirrors
 * billing_config.credit_usd_value, which ai_credit_period divides by. Derived as
 *     min revenue per included credit (49 VND = Start 490,000 / 10,000) x (1 - 0.40 target margin) / 26,000 VND per USD = 0.001131
 * so every plan keeps a 40% gross margin on token cost. The inputs (margin, exchange rate) are only documentation: change the
 * definition in billing_config and here together.
 */
export const CREDIT_USD_VALUE = 0.00113

/**
 * USD per 1M tokens, used only when the provider returns no cost. Approximate list prices, not a contract. `cachedIn` is the price of a
 * prompt token read from the provider's cache (absent: the full input price, as before). Claude Sonnet 5.5: $2 in, $10 out, $0.10
 * cache read (Anthropic first-party list price as cached by the Claude API reference on 2026-11-03; NOT re-read from the live pricing
 * page). Its cache WRITE ($2.50, 1.25x input for the 5-minute TTL) is not priced: the router 0.5.0 folds written tokens into the
 * prompt unsaid, so they are booked at the input price, an under-count of 0.50 USD per million written.
 * Claude Haiku 5.5 (the cheap tier since 2026-11-11): $0.10 in, $0.50 out for prompts up to 100K tokens, from the same cached table
 * (NOT verified live; its cache-read price is not in that table, so a cached token is booked at the input price, and a prompt over
 * 100K tokens, $0.50 / $2.50, is under-counted). OpenAI `text-embedding-3-small` $0.02 in: the repo's earlier line, NOT verified.
 */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number; readonly cachedIn?: number }> = [
    { match: "claude-sonnet-5-5", in: 2, out: 10, cachedIn: 0.1 },
    { match: "claude-haiku-5-5", in: 0.1, out: 0.5 },
    { match: "deepseek-v4.1-flash", in: 0.14, out: 0.42 },
    { match: "deepseek", in: 0.14, out: 0.28 },
    { match: "qwen3-embedding", in: 0.01, out: 0 },
    { match: "text-embedding-3-small", in: 0.02, out: 0 },
    { match: "text-embedding-3-large", in: 0.13, out: 0 },
]
const DEFAULT_PRICE = { in: 0.3, out: 1.2 }

/** Cost in USD from the price table; `cachedTokens` (a part of the prompt) at the cached price where the table names one. */
export const priceOf = (model: string, promptTokens: number, completionTokens: number, cachedTokens = 0): number => {
    const price: { readonly in: number; readonly out: number; readonly cachedIn?: number } = PRICES.find((entry) => model.toLowerCase().includes(entry.match)) ?? DEFAULT_PRICE
    const cached = price.cachedIn === undefined ? 0 : Math.min(cachedTokens, promptTokens)
    const cachedPrice = price.cachedIn ?? price.in
    return ((promptTokens - cached) * price.in + cached * cachedPrice + completionTokens * price.out) / 1_000_000
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
    // A cached count is a part of the prompt it was read with: it is never estimated and never exceeds the prompt.
    const cachedTokens = estimated ? 0 : Math.min(Math.round(countOf(usage?.cached_tokens) ?? 0), Math.round(promptTokens))
    // A cost of zero for tokens that were used is no cost said (the prompt library books 0 when the endpoint gave none, as Anthropic
    // through the router does): the price table prices it, so a model without a reported cost never books free.
    const reported = countOf(usage?.cost)
    const cost =
        reported !== null && (reported > 0 || promptTokens + completionTokens === 0)
            ? reported
            : priceOf(input.model, promptTokens, completionTokens, cachedTokens)
    return {
        promptTokens: Math.round(promptTokens),
        completionTokens: Math.round(completionTokens),
        cachedTokens,
        costUsd: Number(cost.toFixed(8)),
        estimated,
    }
}
