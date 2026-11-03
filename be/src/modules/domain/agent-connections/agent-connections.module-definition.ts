import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentConnectionsOptions } from "./agent-connections.options"

/** The configurable-module base of the agent-connections capability. */
const definition = new ConfigurableModuleBuilder<AgentConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentConnectionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentConnectionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
