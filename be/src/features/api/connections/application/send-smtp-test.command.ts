import { Command } from "@nestjs/cqrs"
import type { SmtpTestResult } from "@modules/domain/email-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SendSmtpTestRequest } from "./send-smtp-test.contracts"

/** Sends a real test email through an SMTP connection. */
export class SendSmtpTestCommand extends Command<SmtpTestResult> {
    constructor(readonly params: ExecuteParams<SendSmtpTestRequest>) {
        super()
    }
}
