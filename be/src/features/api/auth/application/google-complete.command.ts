import { Command } from "@nestjs/cqrs"
import type { GoogleRedirect } from "@modules/domain/identity"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExchangeRequest } from "./auth.contracts"

/** Finishes the Google round trip and opens a session. */
export class GoogleCompleteCommand extends Command<GoogleRedirect> {
    constructor(readonly params: PublicExecuteParams<ExchangeRequest>) {
        super()
    }
}
