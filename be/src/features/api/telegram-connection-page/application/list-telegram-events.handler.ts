import { QueryHandler } from "@nestjs/cqrs"
import { TelegramPageService } from "@modules/domain/channels"
import type { TelegramPageEvent } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListTelegramEventsQuery } from "./list-telegram-events.query"

@QueryHandler(ListTelegramEventsQuery)
/** Answers the live events of a Telegram bot connection through the TelegramPageService. */
export class ListTelegramEventsHandler extends ICQRSHandler<ListTelegramEventsQuery, ReadonlyArray<TelegramPageEvent>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: TelegramPageService,
    ) {
        super(logger)
    }

    protected override process(query: ListTelegramEventsQuery): Promise<ReadonlyArray<TelegramPageEvent>> {
        return this.page.events(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
