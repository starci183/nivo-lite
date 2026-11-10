import { Query } from "@nestjs/cqrs"
import type { LobbyMembership } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMembershipsRequest } from "./list-memberships.contracts"

/** Asks for every workspace the caller belongs to, with the caller's membership in each and the lobby facts of each. */
export class ListMembershipsQuery extends Query<ReadonlyArray<LobbyMembership>> {
    constructor(readonly params: ExecuteParams<ListMembershipsRequest>) {
        super()
    }
}
