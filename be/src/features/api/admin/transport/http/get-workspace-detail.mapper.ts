import type {
    GetWorkspaceDetailRequest,
    GetWorkspaceDetailResult,
} from "../../application/get-workspace-detail.contracts"
import type { GetWorkspaceDetailResponse } from "./dto/get-workspace-detail.response"

/** Maps the HTTP request to the application request. */
export const toGetWorkspaceDetailRequest = (workspaceId: string): GetWorkspaceDetailRequest => ({
    workspaceId,
})

/** Maps the application result to the HTTP response. */
export const toGetWorkspaceDetailResponse = (result: GetWorkspaceDetailResult): GetWorkspaceDetailResponse => result
