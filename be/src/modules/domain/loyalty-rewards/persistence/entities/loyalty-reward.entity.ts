import { Column, Entity } from "typeorm"
import type { ValueTransformer } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { RewardKind } from "../../loyalty-rewards.contracts"

/** Reads the bigint value (text from the driver) as a number; rewards are priced in whole VND. */
const valueTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "loyalty_rewards" })
/** One entry of a workspace's reward catalogue. */
export class LoyaltyRewardEntity extends UuidAbstractEntity {
    /** The workspace that owns the reward. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The key of the reward, unique within the workspace. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The name shown to customers. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** What the reward gives. */
    @Column({ name: "kind", type: "text", default: () => "'voucher'::text" })
    kind!: RewardKind

    /** The cash value in VND. */
    @Column({ name: "value_vnd", type: "bigint", default: () => "0", transformer: valueTransformer })
    valueVnd!: number

    /** The discount percentage, when the reward is one. */
    @Column({ name: "percent", type: "integer", nullable: true })
    percent!: number | null

    /** The points a redemption costs. */
    @Column({ name: "points_cost", type: "integer" })
    pointsCost!: number

    /** The units left, or null for no limit. */
    @Column({ name: "stock", type: "integer", nullable: true })
    stock!: number | null

    /** The most redemptions per customer, or null for no limit. */
    @Column({ name: "per_customer_limit", type: "integer", nullable: true })
    perCustomerLimit!: number | null

    /** The lowest tier that may redeem it, or null. */
    @Column({ name: "min_tier_key", type: "text", nullable: true })
    minTierKey!: string | null

    /** The note of the owner. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** Whether the reward can be redeemed. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The position in the catalogue. */
    @Column({ name: "sort_order", type: "integer", default: () => "0" })
    sortOrder!: number
}
