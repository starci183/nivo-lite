import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentPluginsOptions } from "./agent-plugins.options"

/** The configurable-module base of the agent-plugins capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentPluginsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
