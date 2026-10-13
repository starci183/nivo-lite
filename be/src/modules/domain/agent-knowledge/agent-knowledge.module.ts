import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentKnowledgeLensService } from "./agent-knowledge-lens.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-knowledge.module-definition"
import { KnowledgeGapNotesService } from "./knowledge-gap-notes.service"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { KnowledgeSearchToolService } from "./knowledge-search-tool.service"
import { ModuleProfilesService } from "./module-profiles.service"

@Module({})
/**
 * What an agent knows: its view of the business knowledge (documents, brain facts, lessons, NIVO base rules), the per-turn recall,
 * the knowledge search tool and the noting of the questions it could not answer. It composes the knowledge, brain and modules owners.
 */
export class AgentKnowledgeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            KnowledgeRecallService,
            KnowledgeGapNotesService,
            AgentKnowledgeLensService,
            KnowledgeSearchToolService,
            ModuleProfilesService,
        ]
        return { ...base, providers: [...(base.providers ?? []), ...services], exports: services }
    }
}
