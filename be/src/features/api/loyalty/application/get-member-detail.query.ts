import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetMemberDetailRequest, GetMemberDetailResult } from "./get-member-detail.contracts"

/** Shows one customer with the ledger and what they can redeem. */
export class GetMemberDetailQuery extends Query<GetMemberDetailResult> {
    constructor(readonly params: ExecuteParams<GetMemberDetailRequest>) {
        super()
    }
}
