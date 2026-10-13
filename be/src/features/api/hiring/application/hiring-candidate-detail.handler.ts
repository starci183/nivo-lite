import { QueryHandler } from "@nestjs/cqrs"
import { HiringWorkbenchService } from "@modules/domain/hiring"
import type { HiringCandidateDetailView } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HiringCandidateDetailQuery } from "./hiring-candidate-detail.query"

@QueryHandler(HiringCandidateDetailQuery)
/** The timeline and CV link of one candidate. */
export class HiringCandidateDetailHandler extends ICQRSHandler<HiringCandidateDetailQuery, HiringCandidateDetailView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: HiringWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: HiringCandidateDetailQuery): Promise<HiringCandidateDetailView> {
        return this.workbench.candidateDetail(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.candidateId,
        )
    }
}
