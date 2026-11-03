import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentSchedulesOptions } from "./agent-schedules.options"

/** The configurable-module base of the agent-schedules capability. */
const definition = new ConfigurableModuleBuilder<AgentSchedulesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentSchedulesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentSchedulesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
