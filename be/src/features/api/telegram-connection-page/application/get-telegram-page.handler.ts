import { QueryHandler } from "@nestjs/cqrs"
import { TelegramPageService } from "@modules/domain/channels"
import type { TelegramPageView } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetTelegramPageQuery } from "./get-telegram-page.query"

@QueryHandler(GetTelegramPageQuery)
/** Answers the page of a Telegram bot connection through the TelegramPageService. */
export class GetTelegramPageHandler extends ICQRSHandler<GetTelegramPageQuery, TelegramPageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: TelegramPageService,
    ) {
        super(logger)
    }

    protected override process(query: GetTelegramPageQuery): Promise<TelegramPageView> {
        return this.page.view(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
