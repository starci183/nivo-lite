import { QueryHandler } from "@nestjs/cqrs"
import { ScheduledItemsService } from "@modules/domain/agent-doors"
import type { ScheduledItem } from "@modules/domain/agent-doors"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadScheduledItemsQuery } from "./read-scheduled-items.query"

@QueryHandler(ReadScheduledItemsQuery)
/** Lists what the agents of a workspace have scheduled, for an owner or a manager. */
export class ReadScheduledItemsHandler extends ICQRSHandler<ReadScheduledItemsQuery, ReadonlyArray<ScheduledItem>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly items: ScheduledItemsService,
    ) {
        super(logger)
    }

    protected override process(query: ReadScheduledItemsQuery): Promise<ReadonlyArray<ScheduledItem>> {
        return this.items.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
