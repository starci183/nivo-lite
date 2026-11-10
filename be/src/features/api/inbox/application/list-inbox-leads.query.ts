import { Query } from "@nestjs/cqrs"
import type { InboxLeadsPage } from "@modules/domain/inbox-leads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListInboxLeadsRequest } from "./list-inbox-leads.contracts"

/** Lists the customers of the inbox for one tab, with the counts of every tab, the figures and the agents. */
export class ListInboxLeadsQuery extends Query<InboxLeadsPage> {
    constructor(readonly params: ExecuteParams<ListInboxLeadsRequest>) {
        super()
    }
}
