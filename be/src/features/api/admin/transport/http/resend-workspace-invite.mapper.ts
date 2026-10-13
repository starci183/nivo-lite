import type {
    ResendWorkspaceInviteRequest,
    ResendWorkspaceInviteResult,
} from "../../application/resend-workspace-invite.contracts"
import type { ResendWorkspaceInviteResponse } from "./dto/resend-workspace-invite.response"

/** Maps the HTTP request to the application request. */
export const toResendWorkspaceInviteRequest = (
    workspaceId: string,
    inviteId: string,
): ResendWorkspaceInviteRequest => ({
    workspaceId,
    inviteId,
})

/** Maps the application result to the HTTP response. */
export const toResendWorkspaceInviteResponse = (result: ResendWorkspaceInviteResult): ResendWorkspaceInviteResponse =>
    result
