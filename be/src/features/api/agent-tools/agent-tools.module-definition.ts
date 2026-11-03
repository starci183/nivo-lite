import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentToolsApiOptions } from "./agent-tools.options"

/** The configurable-module base of the agent-tools module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentToolsApiOptions>()
