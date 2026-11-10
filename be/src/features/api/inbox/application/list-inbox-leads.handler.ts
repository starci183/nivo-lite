import { QueryHandler } from "@nestjs/cqrs"
import { InboxLeadsService } from "@modules/domain/inbox-leads"
import type { InboxLeadsPage } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListInboxLeadsQuery } from "./list-inbox-leads.query"

@QueryHandler(ListInboxLeadsQuery)
/** Proves workspace access, then lists its customers through the inbox leads service. */
export class ListInboxLeadsHandler extends ICQRSHandler<ListInboxLeadsQuery, InboxLeadsPage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: InboxLeadsService,
    ) {
        super(logger)
    }

    protected override process(query: ListInboxLeadsQuery): Promise<InboxLeadsPage> {
        return this.leads.list(query.params.principal.id, query.params.request.workspaceId, query.params.request.query)
    }
}
