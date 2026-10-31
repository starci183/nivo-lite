import { Module } from "@nestjs/common"
import { DossierFindingsHandler } from "./application/dossier-findings.handler"
import { DossierReviewSummaryHandler } from "./application/dossier-review-summary.handler"
import { DossierRemedyDraftHandler } from "./application/dossier-remedy-draft.handler"
import { RequestDossierReviewHandler } from "./application/request-dossier-review.handler"
import { ConfirmDossierFindingHandler } from "./application/confirm-dossier-finding.handler"
import { DismissDossierFindingHandler } from "./application/dismiss-dossier-finding.handler"
import { ReopenDossierFindingHandler } from "./application/reopen-dossier-finding.handler"
import { ResolveDossierFindingHandler } from "./application/resolve-dossier-finding.handler"
import { AssignDossierFindingHandler } from "./application/assign-dossier-finding.handler"
import { RequestDossierRemedyDraftHandler } from "./application/request-dossier-remedy-draft.handler"
import { SaveDossierRemedyDraftHandler } from "./application/save-dossier-remedy-draft.handler"
import { ApproveDossierRemedyDraftHandler } from "./application/approve-dossier-remedy-draft.handler"
import { RejectDossierRemedyDraftHandler } from "./application/reject-dossier-remedy-draft.handler"
import { ConfigurableModuleClass } from "./dossier-review.module-definition"

@Module({
    providers: [
        DossierFindingsHandler,
        DossierReviewSummaryHandler,
        DossierRemedyDraftHandler,
        RequestDossierReviewHandler,
        ConfirmDossierFindingHandler,
        DismissDossierFindingHandler,
        ReopenDossierFindingHandler,
        ResolveDossierFindingHandler,
        AssignDossierFindingHandler,
        RequestDossierRemedyDraftHandler,
        SaveDossierRemedyDraftHandler,
        ApproveDossierRemedyDraftHandler,
        RejectDossierRemedyDraftHandler,
    ],
})
/** The dossier review feature: the handlers of its application. */
export class DossierReviewApiModule extends ConfigurableModuleClass {}
