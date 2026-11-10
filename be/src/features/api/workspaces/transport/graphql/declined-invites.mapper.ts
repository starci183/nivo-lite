import type { DeclinedInvite } from "@modules/domain/workspace-invites"
import type { DeclinedInviteType } from "./dto/declined-invite.type"

/** Maps the declined invitations of the workspace to the GraphQL type. */
export const toDeclinedInvitesType = (result: ReadonlyArray<DeclinedInvite>): Array<DeclinedInviteType> =>
    result.map((invite) => ({ ...invite }))
