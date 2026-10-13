import type {
    ResendWorkspaceInviteRequest,
    ResendWorkspaceInviteResult,
} from "../../application/resend-workspace-invite.contracts"
import type { AdminResendWorkspaceInviteInput } from "./dto/admin-resend-workspace-invite.input"
import type { AdminInviteResentType } from "./dto/admin-invite-resent.type"

/** Maps the GraphQL input to the application request. */
export const toAdminResendWorkspaceInviteRequest = (
    input: AdminResendWorkspaceInviteInput,
): ResendWorkspaceInviteRequest => ({
    workspaceId: input.workspaceId,
    inviteId: input.inviteId,
})

/** Maps the application result to the GraphQL type. */
export const toAdminInviteResentType = (result: ResendWorkspaceInviteResult): AdminInviteResentType => ({
    email: result.email,
    delivery: result.delivery,
})
