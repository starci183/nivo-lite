import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExchangeRequest } from "./auth.contracts"

/** Redirects the browser to the Google consent screen with state and PKCE. */
export class GoogleBeginCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ExchangeRequest>) {
        super()
    }
}
