import { DossierFindingEntity } from "./dossier-finding.entity"
import { DossierRemedyDraftEntity } from "./dossier-remedy-draft.entity"
import { DossierReviewRunEntity } from "./dossier-review-run.entity"
import { DossierReviewEntity } from "./dossier-review.entity"

export { DossierFindingEntity, DossierRemedyDraftEntity, DossierReviewEntity, DossierReviewRunEntity }
export type { DossierRunStats } from "./dossier-review-run.entity"
export type { DraftPlaceholder } from "./dossier-remedy-draft.entity"

/** The entities the dossier-review capability owns, collected by the database module. */
export const dossierReviewEntities = [
    DossierReviewRunEntity,
    DossierFindingEntity,
    DossierReviewEntity,
    DossierRemedyDraftEntity,
] as const
