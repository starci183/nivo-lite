import type { ReviewSummary } from "@modules/domain/dossier-review"
import type { DossierReviewSummaryRequest } from "../../application/dossier-review-summary.contracts"
import type { DossierReviewSummaryType } from "./dto/dossier-review-summary.type"

/** Maps the GraphQL input to the request. */
export const toDossierReviewSummaryRequest = (workspaceId: string): DossierReviewSummaryRequest => ({ workspaceId })

/** The record already has the shape of the GraphQL type. */
export const toDossierReviewSummaryType = (result: ReviewSummary): DossierReviewSummaryType => result
