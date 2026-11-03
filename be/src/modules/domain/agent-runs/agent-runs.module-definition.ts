import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentRunsOptions } from "./agent-runs.options"

/** The configurable-module base of the agent-runs capability. */
const definition = new ConfigurableModuleBuilder<AgentRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentRunsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentRunsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
