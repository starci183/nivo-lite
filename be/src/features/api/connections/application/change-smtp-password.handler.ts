import { CommandHandler } from "@nestjs/cqrs"
import { SmtpWizardService } from "@modules/domain/email-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChangeSmtpPasswordCommand } from "./change-smtp-password.command"

@CommandHandler(ChangeSmtpPasswordCommand)
/** Replaces the password of an SMTP connection through the SmtpWizardService. */
export class ChangeSmtpPasswordHandler extends ICQRSHandler<ChangeSmtpPasswordCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: SmtpWizardService,
    ) {
        super(logger)
    }

    protected override process(command: ChangeSmtpPasswordCommand): Promise<void> {
        return this.wizard.changePassword(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.password,
        )
    }
}
