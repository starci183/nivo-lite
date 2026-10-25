import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-sources.module-definition"
import { KnowledgeSourcesService } from "./knowledge-sources.service"

@Module({})
/** The documents of a workspace: their rows, their stages and the jobs that index them. */
export class KnowledgeSourcesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), KnowledgeQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: KNOWLEDGE_STORAGE, useExisting: options.storage },
                KnowledgeSourcesService,
                ApiKnowledgeSourcesService,
            ],
            exports: [KnowledgeSourcesService, ApiKnowledgeSourcesService],
        }
    }
}
