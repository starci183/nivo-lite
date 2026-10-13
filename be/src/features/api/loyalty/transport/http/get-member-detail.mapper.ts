import type { GetMemberDetailRequest, GetMemberDetailResult } from "../../application/get-member-detail.contracts"
import type { GetMemberDetailParamsRequest } from "./dto/get-member-detail.request"
import type { GetMemberDetailResponse } from "./dto/get-member-detail.response"

/** Maps the HTTP input of get-member-detail to the command request. */
export const toGetMemberDetailRequest = (params: GetMemberDetailParamsRequest): GetMemberDetailRequest => ({
    workspaceId: params.workspaceId,
    customerId: params.customerId,
})

/** Maps the get-member-detail result to the HTTP answer. */
export const toGetMemberDetailResponse = (result: GetMemberDetailResult): GetMemberDetailResponse => result
