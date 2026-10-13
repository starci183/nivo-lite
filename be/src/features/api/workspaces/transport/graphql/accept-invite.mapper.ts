import type { AcceptedInvite } from "@modules/domain/workspace-invites"
import type { AcceptInviteRequest } from "../../application/accept-invite.contracts"
import type { AcceptInviteType } from "./dto/accept-invite.type"
import type { InviteTokenInput } from "./dto/invite-token.input"

/** Maps the GraphQL input to the command request. */
export const toAcceptInviteRequest = (input: InviteTokenInput): AcceptInviteRequest => ({ token: input.token })

/** Maps the accepted invitation to the GraphQL type. */
export const toAcceptInviteType = (result: AcceptedInvite): AcceptInviteType => ({
    workspaceId: result.workspaceId,
})
