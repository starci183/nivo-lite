import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SetSignupNameRequest } from "./set-signup-name.contracts"

/** Asks to keep the full name typed at sign-up on the new, unconfirmed account. */
export class SetSignupNameCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SetSignupNameRequest>) {
        super()
    }
}
