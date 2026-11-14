import { tierByKey, tierRank } from "./config"
import type { LoyaltyConfig } from "./config.types"
import type { LoyaltyReward, RedeemBlock, RedeemCandidate } from "./reward.types"

/** Why the customer cannot redeem the reward right now, or null when they can. */
export const redeemBlock = (
    config: LoyaltyConfig,
    reward: LoyaltyReward,
    customer: RedeemCandidate,
): RedeemBlock | null => {
    if (!reward.active) return { code: "inactive", params: {} }
    if (reward.stock !== null && reward.stock <= 0) return { code: "out_of_stock", params: {} }
    if (customer.points < reward.pointsCost) {
        return { code: "not_enough_points", params: { cost: reward.pointsCost, points: customer.points } }
    }
    if (reward.perCustomerLimit !== null && customer.redeemedBefore >= reward.perCustomerLimit) {
        return { code: "limit_reached", params: { limit: reward.perCustomerLimit } }
    }
    const needed = tierByKey(config, reward.minTierKey)
    if (needed !== null && tierRank(config, customer.tierKey) < tierRank(config, needed.key)) {
        return { code: "tier_required", params: { tier: needed.name } }
    }
    return null
}

/** The code a customer shows to receive a reward, made from the end of the redemption key. */
export const redeemCode = (ref: string): string =>
    `QT-${ref
        .replaceAll(/[^a-z0-9]/giu, "")
        .slice(-6)
        .toUpperCase()
        .padStart(6, "0")}`

/** The separator of the id a redemption offer carries: the customer and the reward. */
const REDEEM_KEY_SEPARATOR = "/"

/** The id of one redemption offer: the customer who would redeem and the reward. */
export const redeemKeyOf = (memberId: string, rewardId: string): string =>
    `${memberId}${REDEEM_KEY_SEPARATOR}${rewardId}`

/** The customer and the reward a redemption id names; null for an id that names not both. */
export const redeemKeyParts = (key: string): { readonly memberId: string; readonly rewardId: string } | null => {
    const at = key.indexOf(REDEEM_KEY_SEPARATOR)
    if (at <= 0 || at === key.length - 1) return null
    return { memberId: key.slice(0, at), rewardId: key.slice(at + 1) }
}
