import { Command } from "@nestjs/cqrs"
import type { GoogleCallbackResult } from "@modules/domain/google-connections"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GoogleCallbackRequest } from "./google-callback.contracts"

/** Finishes a Google consent: the signed state is the proof, there is no caller. */
export class GoogleCallbackCommand extends Command<GoogleCallbackResult> {
    constructor(readonly params: PublicExecuteParams<GoogleCallbackRequest>) {
        super()
    }
}
