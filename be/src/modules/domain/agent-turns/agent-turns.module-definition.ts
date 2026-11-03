import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { AGENT_TURNS_OPTIONS } from "./agent-turns.decorators"
import type { AgentTurnsOptions } from "./agent-turns.options"

/** The configurable-module base of the agent-turns capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AgentTurnsOptions>({
    optionsInjectionToken: AGENT_TURNS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentTurnsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentTurnsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
