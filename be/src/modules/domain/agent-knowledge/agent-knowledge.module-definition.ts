import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentKnowledgeOptions } from "./agent-knowledge.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentKnowledgeOptions>()
