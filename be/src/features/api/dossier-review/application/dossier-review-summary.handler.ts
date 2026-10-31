import { QueryHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { ReviewSummary } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DossierReviewSummaryQuery } from "./dossier-review-summary.query"

@QueryHandler(DossierReviewSummaryQuery)
/** Counts the findings that need attention and says whether a review is running. */
export class DossierReviewSummaryHandler extends ICQRSHandler<DossierReviewSummaryQuery, ReviewSummary> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(query: DossierReviewSummaryQuery): Promise<ReviewSummary> {
        return this.findings.summary(query.params.principal.id, query.params.request.workspaceId)
    }
}
