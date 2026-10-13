import { QueryHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TelegramUserReadyQuery } from "./telegram-user-ready.query"

@QueryHandler(TelegramUserReadyQuery)
/** Asks whether this deployment can log in a personal Telegram account through the TelegramUserWizardService. */
export class TelegramUserReadyHandler extends ICQRSHandler<TelegramUserReadyQuery, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: TelegramUserReadyQuery): Promise<boolean> {
        return this.wizard.ready({
            principalId: message.params.principal.id,
            workspaceId: message.params.request.workspaceId,
        })
    }
}
