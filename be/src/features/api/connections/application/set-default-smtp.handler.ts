import { CommandHandler } from "@nestjs/cqrs"
import { SmtpWizardService } from "@modules/domain/email-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetDefaultSmtpCommand } from "./set-default-smtp.command"

@CommandHandler(SetDefaultSmtpCommand)
/** Makes a connected SMTP connection the default sender through the SmtpWizardService. */
export class SetDefaultSmtpHandler extends ICQRSHandler<SetDefaultSmtpCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: SmtpWizardService,
    ) {
        super(logger)
    }

    protected override process(command: SetDefaultSmtpCommand): Promise<void> {
        return this.wizard.setDefault(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
