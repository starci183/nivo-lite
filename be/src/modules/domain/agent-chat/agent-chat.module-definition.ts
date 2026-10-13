import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentChatOptions } from "./agent-chat.options"

/** The configurable module base of the agent chat capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentChatOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
