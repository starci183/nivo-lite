import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-gaps.module-definition"
import { KnowledgeGapsService } from "./knowledge-gaps.service"

@Module({})
/** The knowledge-gaps capability. */
export class KnowledgeGapsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), KnowledgeGapsService],
            exports: [KnowledgeGapsService],
        }
    }
}
