import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentToolsOptions } from "./agent-tools.options"

/** The configurable-module base of the agent tools capability. */
const definition = new ConfigurableModuleBuilder<AgentToolsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentToolsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentToolsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
