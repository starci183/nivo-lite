import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelTelegramLoginCommand } from "./cancel-telegram-login.command"

@CommandHandler(CancelTelegramLoginCommand)
/** Cancels a Telegram login in progress through the TelegramUserWizardService. */
export class CancelTelegramLoginHandler extends ICQRSHandler<CancelTelegramLoginCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: CancelTelegramLoginCommand): Promise<void> {
        return this.wizard.cancelLogin(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request.connectionId,
        )
    }
}
