import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentSchedulesOptions } from "./agent-schedules.options"

/** The configurable-module base of the agent-schedules capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentSchedulesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
