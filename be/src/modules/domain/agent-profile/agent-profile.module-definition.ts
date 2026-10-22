import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentProfileOptions } from "./agent-profile.options"

/** The configurable-module base of the agent profile capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentProfileOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
