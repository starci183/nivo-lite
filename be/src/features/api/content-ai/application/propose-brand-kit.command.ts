import { Command } from "@nestjs/cqrs"
import type { BrandProposal, ProposeBrandRequest } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Reads an attached brand guideline PDF into a brand proposal. */
export class ProposeBrandKitCommand extends Command<BrandProposal> {
    constructor(readonly params: ExecuteParams<ProposeBrandRequest>) {
        super()
    }
}
