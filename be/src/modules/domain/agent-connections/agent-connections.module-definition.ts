import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentConnectionsOptions } from "./agent-connections.options"

/** The configurable-module base of the agent-connections capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
