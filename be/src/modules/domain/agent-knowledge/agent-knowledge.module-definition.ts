import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentKnowledgeOptions } from "./agent-knowledge.options"

/** The configurable-module base of the agent-knowledge capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AgentKnowledgeOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentKnowledgeOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentKnowledgeOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
