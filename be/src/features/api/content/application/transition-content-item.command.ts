import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TransitionContentItemRequest, TransitionContentItemResult } from "./transition-content-item.contracts"

/** Asks the content capability to transition a post. */
export class TransitionContentItemCommand extends Command<TransitionContentItemResult> {
    constructor(readonly params: ExecuteParams<TransitionContentItemRequest>) {
        super()
    }
}
