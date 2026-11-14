import { Module, type DynamicModule } from "@nestjs/common"
import { AgentKnowledgeLensService } from "./agent-knowledge-lens.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-knowledge.module-definition"
import { KnowledgeRecallService } from "./knowledge-recall.service"

@Module({})
/**
 * What an agent knows: its view of the business knowledge (documents, brain facts, lessons, NIVO base rules) and the facts of a view.
 * It composes the knowledge, brain and modules owners.
 */
export class AgentKnowledgeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [KnowledgeRecallService, AgentKnowledgeLensService]
        return { ...base, providers: [...(base.providers ?? []), ...services], exports: services }
    }
}
