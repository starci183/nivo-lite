import { CREDIT_USD_VALUE } from "./usage-cost.policy"

/** The decimals an exact credit figure keeps: below a millionth of a credit is float noise, not cost. */
const CREDIT_DECIMALS = 6

/**
 * The credits a cost is worth, as a FRACTION (owner, 2026-11-11: "số credits trên từng node"): never rounded up per call, so the credits
 * of a node, a document or a run add up to what their calls cost. For display only; a bill rounds its total with `creditsOf`.
 */
export const creditsExact = (costUsd: number): number =>
    Number.isFinite(costUsd) && costUsd > 0 ? Number((costUsd / CREDIT_USD_VALUE).toFixed(CREDIT_DECIMALS)) : 0

/** A cost in USD as booked (8 decimals, the column's scale), zero for anything that is not a cost. */
export const usdExact = (costUsd: number): number =>
    Number.isFinite(costUsd) && costUsd > 0 ? Number(costUsd.toFixed(8)) : 0
