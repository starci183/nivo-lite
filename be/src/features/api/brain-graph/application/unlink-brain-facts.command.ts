import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UnlinkBrainFactsRequest } from "./unlink-brain-facts.contracts"

/** Removes an edge of the truth graph. */
export class UnlinkBrainFactsCommand extends Command<boolean> {
    constructor(readonly params: ExecuteParams<UnlinkBrainFactsRequest>) {
        super()
    }
}
