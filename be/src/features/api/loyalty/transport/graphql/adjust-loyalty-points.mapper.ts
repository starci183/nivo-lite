import type { AdjustPointsRequest, AdjustPointsResult } from "../../application/adjust-points.contracts"
import type { AdjustLoyaltyPointsInput } from "./dto/adjust-loyalty-points.input"
import type { AdjustLoyaltyPointsType } from "./dto/adjust-loyalty-points.type"

/** Maps workspace selection and bounded input into the application request. */
export const toAdjustLoyaltyPointsRequest = (
    input: AdjustLoyaltyPointsInput,
    workspaceId: string,
): AdjustPointsRequest => ({ workspaceId, ...input })

/** Maps the application result into the GraphQL fields. */
export const toAdjustLoyaltyPointsType = (result: AdjustPointsResult): AdjustLoyaltyPointsType => ({ ...result })
