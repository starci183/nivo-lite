import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestReembedRequest } from "./request-reembed.contracts"

/** Asks to give the stale passages of the workspace vectors of the model in use. */
export class RequestReembedCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RequestReembedRequest>) {
        super()
    }
}
