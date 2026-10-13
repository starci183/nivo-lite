import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentAccessLogOptions } from "./agent-access-log.options"

/** Configurable-module base for the agent-access-log capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentAccessLogOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
