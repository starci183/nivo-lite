import type { InviteResult } from "@modules/domain/workspace-invites"
import type { CreateInviteRequest } from "../../application/create-invite.contracts"
import type { RevokeInviteRequest } from "../../application/revoke-invite.contracts"
import type { CreateInviteInput } from "./dto/create-invite.input"
import type { InviteRefInput } from "./dto/invite-ref.input"
import type { InviteResultType } from "./dto/invite-result.type"

/** Maps the GraphQL input that invites a person, with the workspace it names, to the command request. */
export const toCreateInviteRequest = (workspaceId: string, input: CreateInviteInput): CreateInviteRequest => ({
    workspaceId,
    email: input.email,
    role: input.role,
    staffId: input.staffId,
})

/** Maps the invitation a mutation names, with the workspace it belongs to, to the command request. */
export const toInviteRefRequest = (workspaceId: string, input: InviteRefInput): RevokeInviteRequest => ({
    workspaceId,
    inviteId: input.inviteId,
})

/** Maps an invitation result to the GraphQL type. */
export const toInviteResultType = (result: InviteResult): InviteResultType => ({
    email: result.email,
    link: result.link,
    delivery: result.delivery,
})
