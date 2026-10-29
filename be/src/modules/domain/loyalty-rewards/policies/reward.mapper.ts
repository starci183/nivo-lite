import { rowShape } from "@modules/platform/database"
import type { LoyaltyReward } from "../loyalty-rewards.contracts"
import type { LoyaltyRewardEntity } from "../persistence/entities"

/** The columns of a reward the contract carries. */
export type RewardFieldsOfEntity = Pick<
    LoyaltyRewardEntity,
    | "id"
    | "key"
    | "name"
    | "kind"
    | "valueVnd"
    | "percent"
    | "pointsCost"
    | "stock"
    | "perCustomerLimit"
    | "minTierKey"
    | "note"
    | "active"
>

/** The columns a statement that returns a reward answers, in column naming. */
export const REWARD_RETURNING =
    "id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active"

/** One reward as a returning clause answers it. */
export interface RewardRaw {
    /** The reward id. */
    readonly id: string
    /** The key of the reward. */
    readonly key: string
    /** The name shown to customers. */
    readonly name: string
    /** What the reward gives. */
    readonly kind: LoyaltyReward["kind"]
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

/** Whether a returned row holds every reward column with a value of its kind. */
const isRewardColumns = rowShape({
    id: "string",
    key: "string",
    name: "string",
    kind: "string",
    value_vnd: "number",
    percent: "number?",
    points_cost: "number",
    stock: "number?",
    per_customer_limit: "number?",
    min_tier_key: "string?",
    note: "string",
    active: "boolean",
})

/** Whether a returned row is a reward row: every column of its kind, and a kind a reward can have. */
export const isRewardRaw = (value: unknown): value is RewardRaw =>
    isRewardColumns(value) && (value.kind === "voucher" || value.kind === "item" || value.kind === "percent")

/** The reward a stored row holds. */
export const toReward = (row: RewardFieldsOfEntity): LoyaltyReward => ({
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind,
    valueVnd: row.valueVnd,
    percent: row.percent,
    pointsCost: row.pointsCost,
    stock: row.stock,
    perCustomerLimit: row.perCustomerLimit,
    minTierKey: row.minTierKey,
    note: row.note,
    active: row.active,
})

/** The reward a returning clause answered. */
export const toRewardFromRaw = (row: RewardRaw): LoyaltyReward => ({
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
