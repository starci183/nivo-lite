import { DossierFindingEntity } from "./dossier-finding.entity"
import { DossierReviewRunEntity } from "./dossier-review-run.entity"
import { SourceCritiqueEntity } from "./source-critique.entity"

export { DossierFindingEntity, DossierReviewRunEntity, SourceCritiqueEntity }
export type { DossierRunStats } from "./dossier-review-run.entity"

/** The entities the shop-document critic owns, collected by the database module. */
export const dossierReviewEntities: readonly [
    typeof DossierReviewRunEntity,
    typeof DossierFindingEntity,
    typeof SourceCritiqueEntity,
] = [DossierReviewRunEntity, DossierFindingEntity, SourceCritiqueEntity] as const
