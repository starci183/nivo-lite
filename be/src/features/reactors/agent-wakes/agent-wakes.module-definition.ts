import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentWakesOptions } from "./agent-wakes.options"

/** The configurable-module base of the agent-wakes module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentWakesOptions>()
