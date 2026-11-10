import { Query } from "@nestjs/cqrs"
import type { InboxLeadDetail } from "@modules/domain/inbox-leads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetInboxLeadRequest } from "./get-inbox-lead.contracts"

/** Opens one customer: the head, what waits, what they need, the journey and the aside. */
export class GetInboxLeadQuery extends Query<InboxLeadDetail> {
    constructor(readonly params: ExecuteParams<GetInboxLeadRequest>) {
        super()
    }
}
