import { Command } from "@nestjs/cqrs"
import type { AuthorizeGoogleResult } from "./authorize-google.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AuthorizeGoogleRequest } from "./authorize-google.contracts"

/** Starts the Google consent. */
export class AuthorizeGoogleCommand extends Command<AuthorizeGoogleResult> {
    constructor(readonly params: ExecuteParams<AuthorizeGoogleRequest>) {
        super()
    }
}
