import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentsOptions } from "./agents.options"

/** The configurable-module base of the agents capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
