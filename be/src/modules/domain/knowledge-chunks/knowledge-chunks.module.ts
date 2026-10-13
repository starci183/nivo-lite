import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeChunksService } from "./knowledge-chunks.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-chunks.module-definition"

@Module({})
/** The passages of the documents of a workspace: their text and their vectors. */
export class KnowledgeChunksModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), KnowledgeChunksService],
            exports: [KnowledgeChunksService],
        }
    }
}
