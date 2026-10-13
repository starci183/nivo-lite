import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentKnowledgeOptions } from "./agent-knowledge.options"

/** The configurable-module base of the agent-knowledge capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentKnowledgeOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
