import type { RedeemTillRewardRequest, RedeemTillRewardResult } from "../../application/redeem-till-reward.contracts"
import type { RedeemTillRewardBodyRequest } from "./dto/redeem-till-reward.request"
import type { RedeemTillRewardResponse } from "./dto/redeem-till-reward.response"

/** Maps the HTTP input of redeem-till-reward to the command request. */
export const toRedeemTillRewardRequest = (
    body: RedeemTillRewardBodyRequest,
    authorization: string,
): RedeemTillRewardRequest => ({
    phone: body.phone,
    customerId: body.customer_id,
    rewardKey: body.reward_key,
    ref: body.ref,
    authorization: authorization,
})

/** Maps the redeem-till-reward result to the HTTP answer. */
export const toRedeemTillRewardResponse = (result: RedeemTillRewardResult): RedeemTillRewardResponse => ({
    status: result.status,
    code: result.code,
    reward: {
        key: result.reward.key,
        name: result.reward.name,
        value_vnd: result.reward.valueVnd,
        points_cost: result.reward.pointsCost,
    },
    customer: {
        customer_id: result.customer.customerId,
        name: result.customer.name,
        phone: result.customer.phone,
        email: result.customer.email,
        tier: result.customer.tier,
        points: result.customer.points,
        lifetime_spend_vnd: result.customer.lifetimeSpendVnd,
        visits: result.customer.visits,
        last_visit_at: result.customer.lastVisitAt,
    },
})
