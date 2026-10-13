import { tierOf, tierRank } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import type { LoyaltyReward, RedeemBlockMatch, RedeemCandidate } from "../loyalty-rewards.contracts"

/** Why the customer cannot redeem the reward right now, or null when they can. */
export const redeemBlock = (
    config: LoyaltyConfig,
    reward: LoyaltyReward,
    customer: RedeemCandidate,
): RedeemBlockMatch => {
    if (!reward.active) return { code: "inactive", params: {} }
    if (reward.stock !== null && reward.stock <= 0) return { code: "out_of_stock", params: {} }
    if (customer.points < reward.pointsCost) {
        return { code: "not_enough_points", params: { cost: reward.pointsCost, points: customer.points } }
    }
    if (reward.perCustomerLimit !== null && customer.redeemedBefore >= reward.perCustomerLimit) {
        return { code: "limit_reached", params: { limit: reward.perCustomerLimit } }
    }
    const needed = tierOf(config, reward.minTierKey)
    if (needed !== null && tierRank(config, customer.tierKey) < tierRank(config, needed.key)) {
        return { code: "tier_required", params: { tier: needed.name } }
    }
    return null
}
