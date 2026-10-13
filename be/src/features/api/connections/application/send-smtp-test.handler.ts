import { CommandHandler } from "@nestjs/cqrs"
import { SmtpWizardService } from "@modules/domain/email-messages"
import type { SmtpTestResult } from "@modules/domain/email-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendSmtpTestCommand } from "./send-smtp-test.command"

@CommandHandler(SendSmtpTestCommand)
/** Sends a real test email through an SMTP connection through the SmtpWizardService. */
export class SendSmtpTestHandler extends ICQRSHandler<SendSmtpTestCommand, SmtpTestResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: SmtpWizardService,
    ) {
        super(logger)
    }

    protected override process(command: SendSmtpTestCommand): Promise<SmtpTestResult> {
        const r = command.params.request
        const actor = { principalId: command.params.principal.id, workspaceId: r.workspaceId }
        return this.wizard.sendTest(actor, { connectionId: r.connectionId, to: r.to, makeDefault: r.makeDefault })
    }
}
