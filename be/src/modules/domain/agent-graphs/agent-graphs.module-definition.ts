import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentGraphsOptions } from "./agent-graphs.options"

/** The configurable-module base of the agent-graphs capability. */
const definition = new ConfigurableModuleBuilder<AgentGraphsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentGraphsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentGraphsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
