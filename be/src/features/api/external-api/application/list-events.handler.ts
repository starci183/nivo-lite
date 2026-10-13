import { QueryHandler } from "@nestjs/cqrs"
import { PublicEventsService } from "@modules/domain/public-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListEventsResult } from "./list-events.contracts"
import { ListEventsQuery } from "./list-events.query"

@QueryHandler(ListEventsQuery)
/** Lists the evidence log of the key's workspace through one domain-service call that admits the key first. */
export class ListEventsHandler extends ICQRSHandler<ListEventsQuery, ListEventsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly events: PublicEventsService,
    ) {
        super(logger)
    }

    protected override process(query: ListEventsQuery): Promise<ListEventsResult> {
        return this.events.listEvents(query.params.request)
    }
}
