import { QueryHandler } from "@nestjs/cqrs"
import { BrandKitService } from "@modules/domain/content-ai"
import type { BrandProposal } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListBrandProposalsQuery } from "./list-brand-proposals.query"

@QueryHandler(ListBrandProposalsQuery)
/** Lists the brand proposals of an agent instance. */
export class ListBrandProposalsHandler extends ICQRSHandler<ListBrandProposalsQuery, ReadonlyArray<BrandProposal>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brand: BrandKitService,
    ) {
        super(logger)
    }

    protected override process(command: ListBrandProposalsQuery): Promise<ReadonlyArray<BrandProposal>> {
        return this.brand.proposals(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
        )
    }
}
