import { Query } from "@nestjs/cqrs"
import type { PendingInvite } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListInvitesRequest } from "./list-invites.contracts"

/** Asks for the invitations of the caller's workspace that can still be accepted. */
export class ListInvitesQuery extends Query<ReadonlyArray<PendingInvite>> {
    constructor(readonly params: ExecuteParams<ListInvitesRequest>) {
        super()
    }
}
