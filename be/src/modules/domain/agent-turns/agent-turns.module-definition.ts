import { defineCapabilityModule } from "@starci/nest-kit"
import { AGENT_TURNS_OPTIONS } from "./agent-turns.decorators"
import type { AgentTurnsOptions } from "./agent-turns.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentTurnsOptions>({
    optionsInjectionToken: AGENT_TURNS_OPTIONS,
})
