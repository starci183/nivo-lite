import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentConversationsOptions } from "./agent-conversations.options"

/** The configurable-module base of the agent-conversations capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentConversationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
