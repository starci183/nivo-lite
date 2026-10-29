import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { EmailRequest } from "./auth.contracts"

/** Mails the confirmation link again. */
export class ResendCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<EmailRequest>) {
        super()
    }
}
