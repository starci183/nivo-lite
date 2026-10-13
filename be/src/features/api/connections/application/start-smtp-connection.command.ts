import { Command } from "@nestjs/cqrs"
import type { SmtpConnectionView } from "@modules/domain/email-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartSmtpConnectionRequest } from "./start-smtp-connection.contracts"

/** Starts an outgoing email (SMTP) connection as pending. */
export class StartSmtpConnectionCommand extends Command<SmtpConnectionView> {
    constructor(readonly params: ExecuteParams<StartSmtpConnectionRequest>) {
        super()
    }
}
