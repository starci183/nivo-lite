import { Command } from "@nestjs/cqrs"
import type { BulkApplied } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyBrainFactGroupRequest } from "./apply-brain-fact-group.contracts"

/** Applies the checked facts of one internal document together, as one batch that can be taken back. */
export class ApplyBrainFactGroupCommand extends Command<BulkApplied> {
    constructor(readonly params: ExecuteParams<ApplyBrainFactGroupRequest>) {
        super()
    }
}
