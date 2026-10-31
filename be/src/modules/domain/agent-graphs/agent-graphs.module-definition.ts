import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentGraphsOptions } from "./agent-graphs.options"

/** The configurable-module base of the agent-graphs capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentGraphsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
