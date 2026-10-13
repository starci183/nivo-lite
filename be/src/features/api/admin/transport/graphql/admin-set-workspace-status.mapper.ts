import type {
    SetWorkspaceStatusRequest,
    SetWorkspaceStatusResult,
} from "../../application/set-workspace-status.contracts"
import type { AdminSetWorkspaceStatusInput } from "./dto/admin-set-workspace-status.input"
import type { AdminStatusSetType } from "./dto/admin-status-set.type"

/** Maps the GraphQL input to the application request. */
export const toAdminSetWorkspaceStatusRequest = (input: AdminSetWorkspaceStatusInput): SetWorkspaceStatusRequest => ({
    workspaceId: input.workspaceId,
    status: input.status,
})

/** Maps the application result to the GraphQL type. */
export const toAdminStatusSetType = (result: SetWorkspaceStatusResult): AdminStatusSetType => ({
    status: result.status,
})
