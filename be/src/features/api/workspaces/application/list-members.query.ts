import { Query } from "@nestjs/cqrs"
import type { MemberListing } from "@modules/domain/workspace-members"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMembersRequest } from "./list-members.contracts"

/** Asks for everyone in the caller's workspace. */
export class ListMembersQuery extends Query<ReadonlyArray<MemberListing>> {
    constructor(readonly params: ExecuteParams<ListMembersRequest>) {
        super()
    }
}
