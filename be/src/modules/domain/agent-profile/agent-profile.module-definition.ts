import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentProfileOptions } from "./agent-profile.options"

/** The configurable-module base of the agent profile capability. */
const definition = new ConfigurableModuleBuilder<AgentProfileOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentProfileOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentProfileOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
