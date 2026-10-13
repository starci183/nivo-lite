import type { RedeemRewardRequest, RedeemRewardResult } from "../../application/redeem-reward.contracts"
import type { RedeemRewardParamsRequest, RedeemRewardBodyRequest } from "./dto/redeem-reward.request"
import type { RedeemRewardResponse } from "./dto/redeem-reward.response"

/** Maps the HTTP input of redeem-reward to the command request. */
export const toRedeemRewardRequest = (
    params: RedeemRewardParamsRequest,
    body: RedeemRewardBodyRequest,
): RedeemRewardRequest => ({
    workspaceId: params.workspaceId,
    customerId: params.customerId,
    rewardId: body.rewardId,
    token: body.token,
})

/** Maps the redeem-reward result to the HTTP answer. */
export const toRedeemRewardResponse = (result: RedeemRewardResult): RedeemRewardResponse => result
