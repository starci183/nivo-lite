import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { TokenRequest } from "./auth.contracts"

/** Spends a confirmation link. */
export class ConfirmCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<TokenRequest>) {
        super()
    }
}
