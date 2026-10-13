import { QueryHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import type { TelegramChatChoice } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListTelegramChatsQuery } from "./list-telegram-chats.query"

@QueryHandler(ListTelegramChatsQuery)
/** Lists the recent chats of a Telegram account through the TelegramUserWizardService. */
export class ListTelegramChatsHandler extends ICQRSHandler<ListTelegramChatsQuery, ReadonlyArray<TelegramChatChoice>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: ListTelegramChatsQuery): Promise<ReadonlyArray<TelegramChatChoice>> {
        return this.wizard.listChats(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request.connectionId,
        )
    }
}
