import type { AdjustPointsRequest, AdjustPointsResult } from "../../application/adjust-points.contracts"
import type { AdjustPointsParamsRequest, AdjustPointsBodyRequest } from "./dto/adjust-points.request"
import type { AdjustPointsResponse } from "./dto/adjust-points.response"

/** Maps the HTTP input of adjust-points to the command request. */
export const toAdjustPointsRequest = (
    params: AdjustPointsParamsRequest,
    body: AdjustPointsBodyRequest,
): AdjustPointsRequest => ({
    workspaceId: params.workspaceId,
    customerId: params.customerId,
    points: body.points,
    reason: body.reason,
    token: body.token,
})

/** Maps the adjust-points result to the HTTP answer. */
export const toAdjustPointsResponse = (result: AdjustPointsResult): AdjustPointsResponse => result
