import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GoogleCallbackOutcome, GoogleCallbackRequest } from "./google-callback.contracts"

/** Finishes a Google consent: the signed state is the proof, there is no caller. */
export class GoogleCallbackCommand extends Command<GoogleCallbackOutcome> {
    constructor(readonly params: PublicExecuteParams<GoogleCallbackRequest>) {
        super()
    }
}
