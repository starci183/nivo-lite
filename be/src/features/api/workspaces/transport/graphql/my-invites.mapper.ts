import type { InviteForMe } from "@modules/domain/workspace-invites"
import type { DeclineInviteRequest } from "../../application/decline-invite.contracts"
import type { InviteForMeType } from "./dto/invite-for-me.type"
import type { InviteRefInput } from "./dto/invite-ref.input"

/** Maps the invitations addressed to the caller to the GraphQL type. */
export const toInvitesForMeType = (result: ReadonlyArray<InviteForMe>): Array<InviteForMeType> =>
    result.map((invite) => ({ ...invite }))

/** Maps the invitation a lobby mutation names to the command request. */
export const toMyInviteRequest = (input: InviteRefInput): DeclineInviteRequest => ({ inviteId: input.inviteId })
