import { Query } from "@nestjs/cqrs"
import type { ReviewSummary } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DossierReviewSummaryRequest } from "./dossier-review-summary.contracts"

/** Counts the findings that need attention and says whether a review is running. */
export class DossierReviewSummaryQuery extends Query<ReviewSummary> {
    constructor(readonly params: ExecuteParams<DossierReviewSummaryRequest>) {
        super()
    }
}
