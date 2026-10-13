import type { PendingInvite } from "@modules/domain/workspace-invites"
import type { PendingInviteType } from "./dto/pending-invite.type"

/** Maps the pending invitations to the GraphQL type. */
export const toPendingInvitesType = (result: ReadonlyArray<PendingInvite>): Array<PendingInviteType> =>
    result.map((invite) => ({ ...invite }))
