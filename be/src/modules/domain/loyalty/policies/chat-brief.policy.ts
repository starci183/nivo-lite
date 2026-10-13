import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"

/** The values of one reward line of the chat brief: its key, name, cost and the limits the customer meets. */
export const rewardLineParams = (reward: LoyaltyReward): Readonly<Record<string, string | number>> => ({
    key: reward.key,
    name: reward.name,
    cost: reward.pointsCost,
    value: reward.valueVnd,
    limit: reward.perCustomerLimit ?? "-",
    stock: reward.stock ?? "-",
    tier: reward.minTierKey ?? "-",
    note: reward.note === "" ? "-" : reward.note,
})
