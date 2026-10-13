import { CommandHandler } from "@nestjs/cqrs"
import { SmtpWizardService } from "@modules/domain/email-messages"
import type { SmtpConnectionView } from "@modules/domain/email-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartSmtpConnectionCommand } from "./start-smtp-connection.command"

@CommandHandler(StartSmtpConnectionCommand)
/** Starts an outgoing email (SMTP) connection as pending through the SmtpWizardService. */
export class StartSmtpConnectionHandler extends ICQRSHandler<StartSmtpConnectionCommand, SmtpConnectionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: SmtpWizardService,
    ) {
        super(logger)
    }

    protected override process(command: StartSmtpConnectionCommand): Promise<SmtpConnectionView> {
        return this.wizard.start(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request,
        )
    }
}
