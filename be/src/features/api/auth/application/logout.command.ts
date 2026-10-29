import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExchangeRequest } from "./auth.contracts"

/** Ends the session of the refresh token. */
export class LogoutCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ExchangeRequest>) {
        super()
    }
}
