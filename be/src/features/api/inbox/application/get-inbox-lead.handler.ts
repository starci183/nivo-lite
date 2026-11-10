import { QueryHandler } from "@nestjs/cqrs"
import { InboxLeadsService } from "@modules/domain/inbox-leads"
import type { InboxLeadDetail } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetInboxLeadQuery } from "./get-inbox-lead.query"

@QueryHandler(GetInboxLeadQuery)
/** Proves workspace access, then opens one customer through the inbox leads service. */
export class GetInboxLeadHandler extends ICQRSHandler<GetInboxLeadQuery, InboxLeadDetail> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: InboxLeadsService,
    ) {
        super(logger)
    }

    protected override process(query: GetInboxLeadQuery): Promise<InboxLeadDetail> {
        return this.leads.detail(query.params.principal.id, query.params.request.workspaceId, query.params.request.id)
    }
}
