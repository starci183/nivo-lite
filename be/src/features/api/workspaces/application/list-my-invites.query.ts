import { Query } from "@nestjs/cqrs"
import type { InviteForMe } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMyInvitesRequest } from "./list-my-invites.contracts"

/** Asks for the pending invitations addressed to the caller's signed-in email. */
export class ListMyInvitesQuery extends Query<ReadonlyArray<InviteForMe>> {
    constructor(readonly params: ExecuteParams<ListMyInvitesRequest>) {
        super()
    }
}
