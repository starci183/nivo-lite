import { QueryHandler } from "@nestjs/cqrs"
import { ZaloPageService } from "@modules/domain/channels"
import type { ZaloPageEvent } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListZaloEventsQuery } from "./list-zalo-events.query"

@QueryHandler(ListZaloEventsQuery)
/** Answers the live events of a Zalo OA connection through the ZaloPageService. */
export class ListZaloEventsHandler extends ICQRSHandler<ListZaloEventsQuery, ReadonlyArray<ZaloPageEvent>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ZaloPageService,
    ) {
        super(logger)
    }

    protected override process(query: ListZaloEventsQuery): Promise<ReadonlyArray<ZaloPageEvent>> {
        return this.page.events(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
