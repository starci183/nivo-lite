import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./nivo-knowledge.module-definition"
import { NivoKnowledgeService } from "./nivo-knowledge.service"

@Module({})
/** The base knowledge of NIVO: the playbooks every workspace's agents read next to the business documents. */
export class NivoKnowledgeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), NivoKnowledgeService],
            exports: [NivoKnowledgeService],
        }
    }
}
