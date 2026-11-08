import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService, type TelegramLoginProgress } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SubmitTelegramPasswordCommand } from "./submit-telegram-password.command"

@CommandHandler(SubmitTelegramPasswordCommand)
/** Submits the Telegram two-step password through the TelegramUserWizardService. */
export class SubmitTelegramPasswordHandler extends ICQRSHandler<SubmitTelegramPasswordCommand, TelegramLoginProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: SubmitTelegramPasswordCommand): Promise<TelegramLoginProgress> {
        return this.wizard.submitPassword(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request,
        )
    }
}
