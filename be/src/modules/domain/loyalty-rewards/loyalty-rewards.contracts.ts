/** What a reward gives. */
export type RewardKind = "voucher" | "item" | "percent"

/** One reward of the catalogue, redeemed with points. */
export interface LoyaltyReward {
    /** The reward id. */
    readonly id: string
    /** The key the owner and the tills name the reward by. */
    readonly key: string
    /** The name shown to customers. */
    readonly name: string
    /** What the reward gives. */
    readonly kind: RewardKind
    /** The cash value in VND. */
    readonly valueVnd: number
    /** The discount percentage of a percent reward, or null. */
    readonly percent: number | null
    /** The points a redemption costs. */
    readonly pointsCost: number
    /** The units left, or null for unlimited. */
    readonly stock: number | null
    /** The most redemptions per customer, or null for unlimited. */
    readonly perCustomerLimit: number | null
    /** The lowest tier that may redeem it, or null for any. */
    readonly minTierKey: string | null
    /** The note of the owner. */
    readonly note: string
    /** Whether customers may redeem it now. */
    readonly active: boolean
}

/** A reward, or null when there is none. */
export type RewardMatch = LoyaltyReward | null

/** What decides whether a customer may redeem a reward right now. */
export interface RedeemCandidate {
    /** The points the customer holds. */
    readonly points: number
    /** The key of the tier the customer holds, or null. */
    readonly tierKey: string | null
    /** How many times the customer redeemed this reward before. */
    readonly redeemedBefore: number
}

/** Why a reward cannot be redeemed right now. */
export type RedeemBlockCode = "inactive" | "out_of_stock" | "not_enough_points" | "limit_reached" | "tier_required"

/** The reason a redemption is refused, with the numbers or names a message needs. */
export interface RedeemBlock {
    /** The reason. */
    readonly code: RedeemBlockCode
    /** The values that fill the message of the reason. */
    readonly params: Readonly<Record<string, string | number>>
}

/** A refusal, or null when the customer may redeem. */
export type RedeemBlockMatch = RedeemBlock | null

/** A reward the owner saves, with an id when changing an existing reward. */
export interface RewardEdit {
    /** The existing reward, absent for a new reward. */
    readonly id?: string | undefined
    /** A requested stable key, absent to derive one from the name. */
    readonly key?: string | undefined
    /** The name shown to customers. */
    readonly name: string
    /** What the reward gives. */
    readonly kind: RewardKind
    /** The cash value in VND. */
    readonly valueVnd: number
    /** The percentage, or null for other kinds. */
    readonly percent: number | null
    /** The points needed to redeem it. */
    readonly pointsCost: number
    /** The available stock, or null for unlimited. */
    readonly stock: number | null
    /** The redemptions per customer, or null for unlimited. */
    readonly perCustomerLimit: number | null
    /** The lowest tier allowed, or null for any tier. */
    readonly minTierKey: string | null
    /** The owner's note. */
    readonly note: string
    /** Whether customers may redeem it. */
    readonly active: boolean
}

/** Whether removal deleted an unused entry, found none, or paused an entry with immutable history. */
export type RewardRemoval = "deleted" | "missing" | "retired"

/** The ordered scalar parameters shared by reward insert and update statements. */
export type RewardFields = ReadonlyArray<string | number | boolean | null>

/** One starter catalogue entry with its display wording looked up from the catalog. */
export interface RewardPreset extends Omit<RewardEdit, "name" | "note"> {
    /** The catalog key of the default name. */
    readonly nameKey: string
    /** The catalog key of the default note. */
    readonly noteKey: string
}
