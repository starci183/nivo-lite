import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentsOptions } from "./agents.options"

/** The configurable-module base of the agents capability. */
const definition = new ConfigurableModuleBuilder<AgentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
