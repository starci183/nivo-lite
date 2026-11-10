import { Command } from "@nestjs/cqrs"
import type { FactRelation } from "@modules/domain/brain-facts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LinkBrainFactsRequest } from "./link-brain-facts.contracts"

/** Draws an edge between two truths. */
export class LinkBrainFactsCommand extends Command<FactRelation> {
    constructor(readonly params: ExecuteParams<LinkBrainFactsRequest>) {
        super()
    }
}
