import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentWorkOptions } from "./agent-work.options"

/** The configurable-module base of the agent-work capability. */
const definition = new ConfigurableModuleBuilder<AgentWorkOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentWorkOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentWorkOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
