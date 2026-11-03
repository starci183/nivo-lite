import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentToolsHttpOptions } from "./agent-tools-http.options"

/** The configurable-module base of the agent-tools-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentToolsHttpOptions>()
