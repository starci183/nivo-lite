import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentWorkOptions } from "./agent-work.options"

/** The configurable-module base of the agent-work capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentWorkOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
