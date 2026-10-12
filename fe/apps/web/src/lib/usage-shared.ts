/** Client-safe constants of AI usage metering (the server logic lives in usage.ts). */

/** The soft warning starts at this share of the monthly allowance. */
export const WARN_AT = 0.8;

/**
 * Credits per USD of model cost: 1 credit sells for 0.01 USD (100 per USD) and the token cost is at most 40% of the sale
 * (x 2.5), a 60% gross margin on tokens at par (Starter); the Pro and Max bonus credits bring it to 52% and 50% when fully
 * used. Mirrors round(cost_usd * 250, 2) in ai_quota_status.
 */
export const CREDITS_PER_USD = 250;

/** Credits a model cost spends (two decimals, like the database). */
export const creditsOf = (costUsd: number): number => Math.round(costUsd * CREDITS_PER_USD * 100) / 100;
