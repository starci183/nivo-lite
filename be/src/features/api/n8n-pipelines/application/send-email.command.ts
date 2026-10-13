import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { N8nEmailAnswer } from "@modules/domain/n8n-runs"
import type { SendEmailRequest } from "./send-email.contracts"

/** Sends one email of the running workflow. */
export class SendEmailCommand extends Command<N8nEmailAnswer> {
    constructor(readonly params: PublicExecuteParams<SendEmailRequest>) {
        super()
    }
}
