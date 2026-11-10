import { DossierFindingEntity } from "./dossier-finding.entity"
import { DossierRemedyDraftEntity } from "./dossier-remedy-draft.entity"
import { DossierReviewRunEntity } from "./dossier-review-run.entity"
import { DossierReviewEntity } from "./dossier-review.entity"
import { SourceCritiqueEntity } from "./source-critique.entity"

export { DossierFindingEntity, DossierRemedyDraftEntity, DossierReviewEntity, DossierReviewRunEntity, SourceCritiqueEntity }
export type { DossierRunStats } from "./dossier-review-run.entity"
export type { DraftPlaceholder } from "./dossier-remedy-draft.entity"

/** The entities the dossier-review capability owns, collected by the database module. */
export const dossierReviewEntities: readonly [
    typeof DossierReviewRunEntity,
    typeof DossierFindingEntity,
    typeof DossierReviewEntity,
    typeof DossierRemedyDraftEntity,
    typeof SourceCritiqueEntity,
] = [DossierReviewRunEntity, DossierFindingEntity, DossierReviewEntity, DossierRemedyDraftEntity, SourceCritiqueEntity] as const
