import type { LoyaltyReward, RewardKind } from "../loyalty-rewards.contracts"

/** One row of the reward selects. */
export interface RewardRow {
    /** The reward id. */
    readonly id: string
    /** The key of the reward. */
    readonly key: string
    /** The name shown to customers. */
    readonly name: string
    /** What the reward gives. */
    readonly kind: RewardKind
    /** The cash value in VND. */
    readonly value_vnd: number
    /** The discount percentage, or null. */
    readonly percent: number | null
    /** The points a redemption costs. */
    readonly points_cost: number
    /** The units left, or null. */
    readonly stock: number | null
    /** The most redemptions per customer, or null. */
    readonly per_customer_limit: number | null
    /** The lowest tier that may redeem it, or null. */
    readonly min_tier_key: string | null
    /** The note of the owner. */
    readonly note: string
    /** Whether the reward can be redeemed. */
    readonly active: boolean
}

/** The reward a row holds. */
export const toReward = (row: RewardRow): LoyaltyReward => ({
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind,
    valueVnd: row.value_vnd,
    percent: row.percent,
    pointsCost: row.points_cost,
    stock: row.stock,
    perCustomerLimit: row.per_customer_limit,
    minTierKey: row.min_tier_key,
    note: row.note,
    active: row.active,
})
