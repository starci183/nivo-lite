import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ListTillMembersRequest, ListTillMembersResult } from "./list-till-members.contracts"

/** Lists customers or finds one by phone. */
export class ListTillMembersQuery extends Query<ListTillMembersResult> {
    constructor(readonly params: PublicExecuteParams<ListTillMembersRequest>) {
        super()
    }
}
