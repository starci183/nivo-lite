import { ConfigurableModuleBuilder } from "@nestjs/common"
import { AGENT_TURNS_OPTIONS } from "./agent-turns.decorators"
import type { AgentTurnsOptions } from "./agent-turns.options"

/** The configurable-module base of the agent-turns capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentTurnsOptions>({
    optionsInjectionToken: AGENT_TURNS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
