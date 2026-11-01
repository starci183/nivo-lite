import { Command } from "@nestjs/cqrs"
import type { BulkUndone } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UndoBrainFactBatchRequest } from "./undo-brain-fact-batch.contracts"

/** Takes a batch of facts applied together back to review. */
export class UndoBrainFactBatchCommand extends Command<BulkUndone> {
    constructor(readonly params: ExecuteParams<UndoBrainFactBatchRequest>) {
        super()
    }
}
