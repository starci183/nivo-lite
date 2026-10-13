import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RetrySourceRequest } from "./retry-source.contracts"

/** Asks to put a failed or credit-blocked document back on the queue. */
export class RetrySourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<RetrySourceRequest>) {
        super()
    }
}
