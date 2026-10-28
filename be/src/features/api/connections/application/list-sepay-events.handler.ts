import { QueryHandler } from "@nestjs/cqrs"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import type { SepayWebhookEvent } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListSepayEventsQuery } from "./list-sepay-events.query"

@QueryHandler(ListSepayEventsQuery)
/** Asks for the newest webhook deliveries of one SePay connection through the SepayConnectionService. */
export class ListSepayEventsHandler extends ICQRSHandler<ListSepayEventsQuery, ReadonlyArray<SepayWebhookEvent>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sepay: SepayConnectionService,
    ) {
        super(logger)
    }

    protected override process(query: ListSepayEventsQuery): Promise<ReadonlyArray<SepayWebhookEvent>> {
        return this.sepay.events(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
