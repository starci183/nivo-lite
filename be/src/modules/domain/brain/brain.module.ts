import { Module, type DynamicModule } from "@nestjs/common"
import { DocumentCriticService } from "@modules/domain/dossier-review"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { BrainChangeMessagesService } from "./brain-change-messages.service"
import { derivationsProvidersOf } from "./brain-composition.policy"
import { BrainBulkService } from "./brain-bulk.service"
import { BrainCommandRunnerService } from "./brain-command-runner.service"
import { BrainLearningService } from "./brain-learning.service"
import { BrainPageService } from "./brain-page.service"
import { BrainPoliciesService } from "./brain-policies.service"
import { BrainPolicyCandidatesService } from "./brain-policy-candidates.service"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainPolicyDeriveService } from "./brain-policy-derive.service"
import { BrainPolicyReadService } from "./brain-policy-read.service"
import { BrainPolicyStoreService } from "./brain-policy-store.service"
import { BrainTodoService } from "./brain-todo.service"
import { BrainService } from "./brain.service"
import { BRAIN_CORRECTIONS } from "./brain.decorators"
import type { CorrectionSource } from "./brain.contracts"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain.module-definition"
import { BrainGraphService } from "./brain-graph.service"
import { TRUTH_CRITIQUE_GATE } from "./direct-apply.policy"
import { DocumentFactsService } from "./document-facts.service"
import { DocumentNatureAnswerService } from "./document-nature-answer.service"
import { DocumentNatureService } from "./document-nature.service"
import { DocumentPartsService } from "./document-parts.service"
import { DocumentSettleService } from "./document-settle.service"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { TruthCeilingService } from "./truth-ceiling.service"
import { DocumentRelationsService } from "./document-relations.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactVectorsSweepService } from "./fact-vectors-sweep.service"
import { DocumentReviewService } from "./document-review.service"
import { DocumentAreaService } from "./document-area.service"
import { IndexedSourcesService } from "./indexed-sources.service"
import { ModelJsonService } from "./model-json.service"

/**
 * The derivations mode: the policy derivations, with the knowledge queue their requests are written to; with `vectors`, the vectors
 * listener of the facts too (it needs the global AI endpoint and usage meter of the app: the mcp registers both).
 */
const derivationsOnlyOf = (base: DynamicModule, vectors: boolean): DynamicModule => ({
    ...base,
    imports: [KnowledgeQueueModule.register({}), ...(base.imports ?? [])],
    exports: [BrainPolicyDerivationsService],
    providers: [...derivationsProvidersOf(vectors), ...(base.providers ?? [])],
})

/** The correction source of a composition that names none: it reads no correction. */
const NO_CORRECTIONS: CorrectionSource = { recent: () => Promise.resolve([]) }

@Module({})
/** The second brain: one shared memory per workspace, its facts read out of documents, its lessons learnt from the owner's corrections. */
export class BrainModule extends ConfigurableModuleClass {
    /**
     * Registers the capability once per app; the derivations mode (mcp, cli) registers the policy derivations with their queue, and the
     * mcp adds the vectors listener (`vectors: true`).
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.derivationsOnly === true) return derivationsOnlyOf(base, options.vectors === true)
        // The truths in force read by words alone (the mcp app): nothing that writes, derives or embeds.
        if (options.graphOnly === true)
            return { ...base, providers: [...(base.providers ?? []), BrainGraphService], exports: [BrainGraphService] }
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                options.corrections === undefined
                    ? { provide: BRAIN_CORRECTIONS, useValue: NO_CORRECTIONS }
                    : { provide: BRAIN_CORRECTIONS, useClass: options.corrections },
                { provide: INBOX, useClass: InboxService },
                BrainPageService,
                BrainTodoService,
                BrainService,
                BrainBulkService,
                BrainLearningService,
                BrainCommandRunnerService,
                DocumentFactsService,
                DocumentTruthStagesService,
                DocumentNatureService,
                DocumentNatureAnswerService,
                DocumentSettleService,
                DocumentPartsService,
                TruthCeilingService,
                // The critic's open contradiction points (and an addressed-to-an-AI flag) are what holds a truth back from going in force.
                { provide: TRUTH_CRITIQUE_GATE, useExisting: DocumentCriticService },
                DocumentRelationsService,
                FactEmbeddingsService,
                FactVectorsSweepService,
                BrainGraphService,
                DocumentReviewService,
                DocumentAreaService,
                IndexedSourcesService,
                ModelJsonService,
                BrainChangeMessagesService,
                BrainPoliciesService,
                BrainPolicyStoreService,
                BrainPolicyCandidatesService,
                BrainPolicyDerivationsService,
                BrainPolicyDeriveService,
                BrainPolicyReadService,
            ],
            exports: [
                IndexedSourcesService,
                DocumentNatureAnswerService,
                BrainCommandRunnerService,
                BrainPageService,
                BrainTodoService,
                BrainService,
                DocumentAreaService,
                BrainBulkService,
                BrainLearningService,
                DocumentFactsService,
                DocumentPartsService,
                TruthCeilingService,
                BrainGraphService,
                FactEmbeddingsService,
                BrainChangeMessagesService,
                BrainPoliciesService,
                BrainPolicyDerivationsService,
                BrainPolicyDeriveService,
                BrainPolicyReadService,
            ],
        }
    }
}
