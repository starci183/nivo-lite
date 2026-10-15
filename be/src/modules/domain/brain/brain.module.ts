import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BrainCommandRunnerService } from "./brain-command-runner.service"
import { BrainLearningService } from "./brain-learning.service"
import { BrainPageService } from "./brain-page.service"
import { BrainService } from "./brain.service"
import { BRAIN_CORRECTIONS } from "./brain.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain.module-definition"
import { DocumentFactsService } from "./document-facts.service"
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
                BrainPageService,
                BrainService,
                BrainLearningService,
                BrainCommandRunnerService,
                DocumentFactsService,
                ModelJsonService,
            ],
            exports: [
                BrainCommandRunnerService,
                BrainPageService,
                BrainService,
                BrainLearningService,
                DocumentFactsService,
            ],
        }
    }
}
