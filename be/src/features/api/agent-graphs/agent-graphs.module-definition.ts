import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentGraphsApiOptions } from "./agent-graphs.options"

/** The configurable-module base of the agent graph module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentGraphsApiOptions>()
