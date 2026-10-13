import { QueryHandler } from "@nestjs/cqrs"
import { PublicLeadsService } from "@modules/domain/public-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListLeadsResult } from "./list-leads.contracts"
import { ListLeadsQuery } from "./list-leads.query"

@QueryHandler(ListLeadsQuery)
/** Lists the customers of the key's workspace through one domain-service call that admits the key first. */
export class ListLeadsHandler extends ICQRSHandler<ListLeadsQuery, ListLeadsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: PublicLeadsService,
    ) {
        super(logger)
    }

    protected override process(query: ListLeadsQuery): Promise<ListLeadsResult> {
        return this.leads.listLeads(query.params.request)
    }
}
