import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DossierFindingInUseService } from "./dossier-finding-in-use.service"
import { DossierFindingsService } from "./dossier-findings.service"
import { DossierRemedyDraftsService } from "./dossier-remedy-drafts.service"
import { DOCUMENT_CRITIC_MODEL } from "./document-critic.port"
import { DocumentCriticService } from "./document-critic.service"
import { DocumentCritiqueAnswersService } from "./document-critique-answers.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import { DOSSIER_REASONER, REMEDY_WRITER } from "./dossier-review.decorators"
import { KeyedTruthCandidatesService } from "./keyed-truth-candidates.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dossier-review.module-definition"
import { DossierReviewRunnerService } from "./dossier-review-runner.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { ReviewCriticService } from "./review-critic.service"
import { ReviewInputsService } from "./review-inputs.service"

@Module({})
/** The dossier review of the Second Brain: findings, runs, the status of each dossier and the remedy drafts NIVO writes. */
export class DossierReviewModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the two services that call the model; the read-only mode registers the findings reads alone. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.readOnly === true) {
            return {
                ...base,
                providers: [
                    ...(base.providers ?? []),
                    ReviewInputsService,
                    DossierFindingInUseService,
                    DossierFindingsService,
                ],
                exports: [DossierFindingsService],
            }
        }
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DOSSIER_REASONER, useClass: options.reasoner },
                { provide: REMEDY_WRITER, useClass: options.writer },
                // The critic model is the reasoner class (one class, two ports); the shop candidates (SHOP_TRUTH_CANDIDATES) are provided by
                // the brain module (exact key + BG2's meaning read, `DocumentCriticCandidatesService`).
                { provide: DOCUMENT_CRITIC_MODEL, useExisting: DOSSIER_REASONER },
                KeyedTruthCandidatesService,
                DocumentCriticService,
                DocumentCritiqueReadService,
                DocumentCritiqueAnswersService,
                ReviewInputsService,
                ReviewCriticService,
                DossierReviewRunsService,
                DossierReviewRunnerService,
                DossierFindingInUseService,
                DossierFindingsService,
                DossierRemedyDraftsService,
            ],
            exports: [
                DOSSIER_REASONER,
                REMEDY_WRITER,
                DossierReviewRunsService,
                DossierReviewRunnerService,
                DossierFindingsService,
                DossierRemedyDraftsService,
                DocumentCriticService,
                DocumentCritiqueReadService,
                DocumentCritiqueAnswersService,
                KeyedTruthCandidatesService,
            ],
        }
    }
}
