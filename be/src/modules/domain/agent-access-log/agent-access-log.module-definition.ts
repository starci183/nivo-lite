import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentAccessLogOptions } from "./agent-access-log.options"

/** Configurable-module base for the agent-access-log capability. */
const definition = new ConfigurableModuleBuilder<AgentAccessLogOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentAccessLogOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentAccessLogOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
