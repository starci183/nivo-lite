import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { BrainBulkService } from "./brain-bulk.service"
import { BrainCommandRunnerService } from "./brain-command-runner.service"
import { BrainLearningService } from "./brain-learning.service"
import { BrainPageService } from "./brain-page.service"
import { BrainTodoService } from "./brain-todo.service"
import { BrainService } from "./brain.service"
import { BRAIN_CORRECTIONS } from "./brain.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain.module-definition"
import { DocumentFactsService } from "./document-facts.service"
import { DocumentReviewService } from "./document-review.service"
import { IndexedSourcesService } from "./indexed-sources.service"
import { ModelJsonService } from "./model-json.service"

@Module({})
/** The second brain: one shared memory per workspace, its facts read out of documents, its lessons learnt from the owner's corrections. */
export class BrainModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: BRAIN_CORRECTIONS, useClass: options.corrections },
                { provide: INBOX, useClass: InboxService },
                BrainPageService,
                BrainTodoService,
                BrainService,
                BrainBulkService,
                BrainLearningService,
                BrainCommandRunnerService,
                DocumentFactsService,
                DocumentReviewService,
                IndexedSourcesService,
                ModelJsonService,
            ],
            exports: [
                IndexedSourcesService,
                BrainCommandRunnerService,
                BrainPageService,
                BrainTodoService,
                BrainService,
                BrainBulkService,
                BrainLearningService,
                DocumentFactsService,
            ],
        }
    }
}
