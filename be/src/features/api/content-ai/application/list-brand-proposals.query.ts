import { Query } from "@nestjs/cqrs"
import type { BrandProposal } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListBrandProposalsRequest } from "./list-brand-proposals.contracts"

/** Lists the brand proposals of an agent instance. */
export class ListBrandProposalsQuery extends Query<ReadonlyArray<BrandProposal>> {
    constructor(readonly params: ExecuteParams<ListBrandProposalsRequest>) {
        super()
    }
}
