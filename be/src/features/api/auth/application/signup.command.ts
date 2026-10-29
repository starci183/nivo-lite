import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SignupRequest } from "./auth.contracts"

/** Creates an unconfirmed account and mails its confirmation link. */
export class SignupCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SignupRequest>) {
        super()
    }
}
