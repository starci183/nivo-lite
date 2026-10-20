import { Command } from "@nestjs/cqrs"
import type { BrandProposal } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideBrandProposalRequest } from "./decide-brand-proposal.contracts"

/** Confirms or rejects a brand proposal. */
export class DecideBrandProposalCommand extends Command<BrandProposal> {
    constructor(readonly params: ExecuteParams<DecideBrandProposalRequest>) {
        super()
    }
}
