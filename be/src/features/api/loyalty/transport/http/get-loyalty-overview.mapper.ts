import type {
    GetLoyaltyOverviewRequest,
    GetLoyaltyOverviewResult,
} from "../../application/get-loyalty-overview.contracts"
import type { GetLoyaltyOverviewParamsRequest } from "./dto/get-loyalty-overview.request"
import type { GetLoyaltyOverviewResponse } from "./dto/get-loyalty-overview.response"

/** Maps the HTTP input of get-loyalty-overview to the command request. */
export const toGetLoyaltyOverviewRequest = (params: GetLoyaltyOverviewParamsRequest): GetLoyaltyOverviewRequest => ({
    workspaceId: params.workspaceId,
})

/** Maps the get-loyalty-overview result to the HTTP answer. */
export const toGetLoyaltyOverviewResponse = (result: GetLoyaltyOverviewResult): GetLoyaltyOverviewResponse => result
