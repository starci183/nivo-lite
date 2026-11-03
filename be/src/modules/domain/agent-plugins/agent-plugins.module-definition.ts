import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentPluginsOptions } from "./agent-plugins.options"

/** The configurable-module base of the agent-plugins capability. */
const definition = new ConfigurableModuleBuilder<AgentPluginsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentPluginsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentPluginsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
