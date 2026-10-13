import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveTelegramUserSetupCommand } from "./save-telegram-user-setup.command"

@CommandHandler(SaveTelegramUserSetupCommand)
/** Saves the chosen Telegram chats and schedule through the TelegramUserWizardService. */
export class SaveTelegramUserSetupHandler extends ICQRSHandler<SaveTelegramUserSetupCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: SaveTelegramUserSetupCommand): Promise<void> {
        return this.wizard.saveSetup(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request,
        )
    }
}
