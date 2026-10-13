import { CommandHandler } from "@nestjs/cqrs"
import { TelegramUserWizardService } from "@modules/domain/data-hub"
import type { TelegramLoginProgress } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitTelegramCodeCommand } from "./submit-telegram-code.command"

@CommandHandler(SubmitTelegramCodeCommand)
/** Submits the Telegram login code through the TelegramUserWizardService. */
export class SubmitTelegramCodeHandler extends ICQRSHandler<SubmitTelegramCodeCommand, TelegramLoginProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: TelegramUserWizardService,
    ) {
        super(logger)
    }

    protected override process(message: SubmitTelegramCodeCommand): Promise<TelegramLoginProgress> {
        return this.wizard.submitCode(
            { principalId: message.params.principal.id, workspaceId: message.params.request.workspaceId },
            message.params.request,
        )
    }
}
