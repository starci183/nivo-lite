import { Command } from "@nestjs/cqrs"
import type { MetaCallbackResult } from "@modules/domain/meta-connections"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { MetaCallbackRequest } from "./meta-callback.contracts"

/** Finishes a Meta login: the signed state is the proof, there is no caller. */
export class MetaCallbackCommand extends Command<MetaCallbackResult> {
    constructor(readonly params: PublicExecuteParams<MetaCallbackRequest>) {
        super()
    }
}
