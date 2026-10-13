import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { MetaCallbackOutcome, MetaCallbackRequest } from "./meta-callback.contracts"

/** Finishes a Meta login: the signed state is the proof, there is no caller. */
export class MetaCallbackCommand extends Command<MetaCallbackOutcome> {
    constructor(readonly params: PublicExecuteParams<MetaCallbackRequest>) {
        super()
    }
}
