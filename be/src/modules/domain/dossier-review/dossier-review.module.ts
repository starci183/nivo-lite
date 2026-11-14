import { Module, type DynamicModule } from "@nestjs/common"
import { CritiqueDecisionsService } from "./critique-decisions.service"
import { CritiqueScopeService } from "./critique-scope.service"
import { DOCUMENT_CRITIC_MODEL, SHOP_TRUTH_CANDIDATES } from "./document-critic.port"
import { DocumentCriticService } from "./document-critic.service"
import { DocumentCritiqueAnswersService } from "./document-critique-answers.service"
import { DocumentCritiqueReadService } from "./document-critique-read.service"
import { KeyedTruthCandidatesService } from "./keyed-truth-candidates.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dossier-review.module-definition"
import { DossierReviewRunnerService } from "./dossier-review-runner.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { ReviewCriticService } from "./review-critic.service"

@Module({})
/**
 * The shop-document critic of the Second Brain: it checks one shop document against itself and the shop's truths, keeps its points,
 * takes the founder's answers, and runs on the review runs of the knowledge queue.
 */
export class DossierReviewModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app with the class that calls the model. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DOCUMENT_CRITIC_MODEL, useClass: options.model },
                // The shop candidates of the critic's rules are the exact-key read of this module (same key, another value: the
                // contradiction the rules raise).
                KeyedTruthCandidatesService,
                { provide: SHOP_TRUTH_CANDIDATES, useExisting: KeyedTruthCandidatesService },
                CritiqueScopeService,
                DocumentCriticService,
                DocumentCritiqueReadService,
                DocumentCritiqueAnswersService,
                CritiqueDecisionsService,
                ReviewCriticService,
                DossierReviewRunsService,
                DossierReviewRunnerService,
            ],
            exports: [
                DossierReviewRunsService,
                DossierReviewRunnerService,
                DocumentCriticService,
                DocumentCritiqueReadService,
                DocumentCritiqueAnswersService,
                CritiqueDecisionsService,
            ],
        }
    }
}
