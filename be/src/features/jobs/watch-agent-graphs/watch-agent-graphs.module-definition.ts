import { defineConfigurableModule } from "@starci/nest-kit"
import type { WatchAgentGraphsOptions } from "./watch-agent-graphs.options"

/** The configurable-module base of the watch-agent-graphs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WatchAgentGraphsOptions>()
