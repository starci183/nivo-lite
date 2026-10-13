import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentMessagesOptions } from "./agent-messages.options"

/** The configurable-module base of the agent-messages capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
