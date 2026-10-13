import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResendTelegramCodeCommand } from "./resend-telegram-code.command"

@CommandHandler(ResendTelegramCodeCommand)
/** Asks Telegram for a fresh login code through the TelegramUserWizardService. */
export class ResendTelegramCodeHandler extends ICQRSHandler<ResendTelegramCodeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: ResendTelegramCodeCommand): Promise<void> {
        return this.wizard.resendCode(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request.connectionId,
        )
    }
}
