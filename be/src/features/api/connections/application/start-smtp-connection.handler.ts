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
        const r = command.params.request
        const actor = { principalId: command.params.principal.id, workspaceId: r.workspaceId }
        return this.wizard.start(actor, { preset: r.preset, host: r.host, port: r.port, security: r.security, user: r.user, password: r.password, fromName: r.fromName, fromEmail: r.fromEmail, replyTo: r.replyTo })
    }
}
