import { Command } from "@nestjs/cqrs"
import type { ReviewRunRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestDossierReviewRequest } from "./request-dossier-review.contracts"

/** Asks for the review of one dossier, or of the whole set. */
export class RequestDossierReviewCommand extends Command<ReviewRunRecord> {
    constructor(readonly params: ExecuteParams<RequestDossierReviewRequest>) {
        super()
    }
}
