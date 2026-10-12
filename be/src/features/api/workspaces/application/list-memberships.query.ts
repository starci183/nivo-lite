import { Query } from "@nestjs/cqrs"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMembershipsRequest } from "./list-memberships.contracts"

/** Asks for every workspace the caller belongs to, with the caller's membership in each. */
export class ListMembershipsQuery extends Query<ReadonlyArray<WorkspaceMembership>> {
    constructor(readonly params: ExecuteParams<ListMembershipsRequest>) {
        super()
    }
}
