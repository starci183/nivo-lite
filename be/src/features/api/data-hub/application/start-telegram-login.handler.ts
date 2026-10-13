import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import type { TelegramLoginStarted } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartTelegramLoginCommand } from "./start-telegram-login.command"

@CommandHandler(StartTelegramLoginCommand)
/** Sends the Telegram login code through the TelegramUserWizardService. */
export class StartTelegramLoginHandler extends ICQRSHandler<StartTelegramLoginCommand, TelegramLoginStarted> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: StartTelegramLoginCommand): Promise<TelegramLoginStarted> {
        return this.wizard.startLogin(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request,
        )
    }
}
