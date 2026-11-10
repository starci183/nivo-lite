import { Query } from "@nestjs/cqrs"
import type { DeclinedInvite } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListDeclinedInvitesRequest } from "./list-declined-invites.contracts"

/** Asks for the invitations of a workspace the invited people declined lately. */
export class ListDeclinedInvitesQuery extends Query<ReadonlyArray<DeclinedInvite>> {
    constructor(readonly params: ExecuteParams<ListDeclinedInvitesRequest>) {
        super()
    }
}
