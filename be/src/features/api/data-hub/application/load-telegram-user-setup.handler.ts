import { QueryHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import type { TelegramSetupState } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadTelegramUserSetupQuery } from "./load-telegram-user-setup.query"

@QueryHandler(LoadTelegramUserSetupQuery)
/** Reads where a Telegram connection wizard continues through the TelegramUserWizardService. */
export class LoadTelegramUserSetupHandler extends ICQRSHandler<LoadTelegramUserSetupQuery, TelegramSetupState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: LoadTelegramUserSetupQuery): Promise<TelegramSetupState> {
        return this.wizard.load(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request.connectionId,
        )
    }
}
