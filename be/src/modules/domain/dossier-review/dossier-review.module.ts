import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DossierFindingsService } from "./dossier-findings.service"
import { DossierRemedyDraftsService } from "./dossier-remedy-drafts.service"
import { DOSSIER_REASONER, REMEDY_WRITER } from "./dossier-review.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dossier-review.module-definition"
import { DossierReviewRunnerService } from "./dossier-review-runner.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { ReviewInputsService } from "./review-inputs.service"

@Module({})
/** The dossier review of the Second Brain: findings, runs, the status of each dossier and the remedy drafts NIVO writes. */
export class DossierReviewModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the two services that call the model. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DOSSIER_REASONER, useClass: options.reasoner },
                { provide: REMEDY_WRITER, useClass: options.writer },
                ReviewInputsService,
                DossierReviewRunsService,
                DossierReviewRunnerService,
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
            ],
        }
    }
}
