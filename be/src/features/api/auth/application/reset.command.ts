import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ResetRequest } from "./auth.contracts"

/** Spends a password link and sets the new password. */
export class ResetCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ResetRequest>) {
        super()
    }
}
