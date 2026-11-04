import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentRunsApiOptions } from "./agent-runs.options"

/** The configurable-module base of the agent-runs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentRunsApiOptions>()
