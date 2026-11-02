import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentRunsOptions } from "./agent-runs.options"

/** The configurable-module base of the agent-runs capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
