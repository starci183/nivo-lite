import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BrainLearningService } from "./brain-learning.service"
import { BrainService } from "./brain.service"
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
            providers: [...(base.providers ?? []), BrainService, BrainLearningService, DocumentFactsService, ModelJsonService],
            exports: [BrainService, BrainLearningService, DocumentFactsService],
        }
    }
}
