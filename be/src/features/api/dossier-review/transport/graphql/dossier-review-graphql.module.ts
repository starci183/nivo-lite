import { Module } from "@nestjs/common"
import { DossierReviewApiModule } from "../../dossier-review.module"
import { ConfigurableModuleClass } from "./dossier-review-graphql.module-definition"
import { DossierFindingsResolver } from "./dossier-findings.resolver"
import { DossierReviewSummaryResolver } from "./dossier-review-summary.resolver"
import { DossierRemedyDraftResolver } from "./dossier-remedy-draft.resolver"
import { RequestDossierReviewResolver } from "./request-dossier-review.resolver"
import { ConfirmDossierFindingResolver } from "./confirm-dossier-finding.resolver"
import { DismissDossierFindingResolver } from "./dismiss-dossier-finding.resolver"
import { ReopenDossierFindingResolver } from "./reopen-dossier-finding.resolver"
import { ResolveDossierFindingResolver } from "./resolve-dossier-finding.resolver"
import { AssignDossierFindingResolver } from "./assign-dossier-finding.resolver"
import { RequestDossierRemedyDraftResolver } from "./request-dossier-remedy-draft.resolver"
import { SaveDossierRemedyDraftResolver } from "./save-dossier-remedy-draft.resolver"
import { ApproveDossierRemedyDraftResolver } from "./approve-dossier-remedy-draft.resolver"
import { RejectDossierRemedyDraftResolver } from "./reject-dossier-remedy-draft.resolver"

@Module({
    imports: [DossierReviewApiModule.register({})],
    providers: [
        DossierFindingsResolver,
        DossierReviewSummaryResolver,
        DossierRemedyDraftResolver,
        RequestDossierReviewResolver,
        ConfirmDossierFindingResolver,
        DismissDossierFindingResolver,
        ReopenDossierFindingResolver,
        ResolveDossierFindingResolver,
        AssignDossierFindingResolver,
        RequestDossierRemedyDraftResolver,
        SaveDossierRemedyDraftResolver,
        ApproveDossierRemedyDraftResolver,
        RejectDossierRemedyDraftResolver,
    ],
})
/** The GraphQL transport of the dossier review feature. */
export class DossierReviewGraphqlModule extends ConfigurableModuleClass {}
