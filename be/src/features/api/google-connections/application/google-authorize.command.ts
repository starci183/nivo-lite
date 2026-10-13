import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GoogleAuthorizeRequest, GoogleAuthorizeResult } from "./google-authorize.contracts"

/** Starts the Google consent and answers the Google url. */
export class GoogleAuthorizeCommand extends Command<GoogleAuthorizeResult> {
    constructor(readonly params: ExecuteParams<GoogleAuthorizeRequest>) {
        super()
    }
}
