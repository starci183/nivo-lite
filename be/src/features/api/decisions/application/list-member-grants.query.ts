import { Query } from "@nestjs/cqrs"
import type { MemberGrant } from "@modules/domain/member-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMemberGrantsRequest } from "./list-member-grants.contracts"

/** Asks for what each member may approve for one action. */
export class ListMemberGrantsQuery extends Query<ReadonlyArray<MemberGrant>> {
    constructor(readonly params: ExecuteParams<ListMemberGrantsRequest>) {
        super()
    }
}
