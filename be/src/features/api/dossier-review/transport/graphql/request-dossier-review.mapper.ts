import type { ReviewRunRecord } from "@modules/domain/dossier-review"
import type { RequestDossierReviewRequest } from "../../application/request-dossier-review.contracts"
import type { RequestDossierReviewInput } from "./dto/request-dossier-review.input"
import type { DossierReviewRunType } from "./dto/dossier-review-run.type"

/** Maps the GraphQL input to the request. */
export const toRequestDossierReviewRequest = (
    workspaceId: string,
    input: RequestDossierReviewInput,
): RequestDossierReviewRequest => ({
    workspaceId,
    dossierId: input.dossierId,
})

/** The record already has the shape of the GraphQL type. */
export const toRequestDossierReviewType = (result: ReviewRunRecord): DossierReviewRunType => result
