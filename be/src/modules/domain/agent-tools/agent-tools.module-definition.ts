import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentToolsOptions } from "./agent-tools.options"

/** The configurable-module base of the agent tools capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentToolsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
