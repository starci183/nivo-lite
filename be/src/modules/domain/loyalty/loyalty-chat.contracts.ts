import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"

/** The member and the reward a chat redeem is about. */
export interface RewardLineFacts {
    /** The member. */
    readonly customerId: string
    /** The member's name. */
    readonly customerName: string
    /** The reward. */
    readonly reward: LoyaltyReward
}

/** The member may redeem the reward: the caller opens the gated request. */
export interface RedeemOpen extends RewardLineFacts {
    /** Open. */
    readonly kind: "open"
}

/** The member may not redeem the reward right now, and why (not_enough_points, limit_reached, tier_required...). */
export interface RedeemBlocked extends RewardLineFacts {
    /** Blocked. */
    readonly kind: "blocked"
    /** The block code. */
    readonly reason: string
}

/** Nothing to do: no active programme, a stranger, or a reward key the catalogue does not have. */
export interface RedeemNone {
    /** None. */
    readonly kind: "none"
}

/** What a redeem the model proposed in a chat comes to. */
export type ChatRedeemIntent = RedeemOpen | RedeemBlocked | RedeemNone
