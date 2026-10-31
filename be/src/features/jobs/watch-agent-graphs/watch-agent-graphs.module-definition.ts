import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WatchAgentGraphsOptions } from "./watch-agent-graphs.options"

/** The configurable-module base of the watch-agent-graphs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WatchAgentGraphsOptions>().setClassMethodName("register").build()
