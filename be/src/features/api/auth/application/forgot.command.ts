import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { EmailRequest } from "./auth.contracts"

/** Emails a password link when the address has an account. */
export class ForgotCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<EmailRequest>) {
        super()
    }
}
