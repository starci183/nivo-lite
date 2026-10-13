import type {
    SetWorkspaceStatusRequest,
    SetWorkspaceStatusResult,
} from "../../application/set-workspace-status.contracts"
import type { SetWorkspaceStatusRequest as SetWorkspaceStatusHttpRequest } from "./dto/set-workspace-status.request"
import type { SetWorkspaceStatusResponse } from "./dto/set-workspace-status.response"

/** Maps the HTTP request to the application request. */
export const toSetWorkspaceStatusRequest = (
    workspaceId: string,
    input: SetWorkspaceStatusHttpRequest,
): SetWorkspaceStatusRequest => ({
    workspaceId,
    status: input.status,
})

/** Maps the application result to the HTTP response. */
export const toSetWorkspaceStatusResponse = (result: SetWorkspaceStatusResult): SetWorkspaceStatusResponse => result
