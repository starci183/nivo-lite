import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentGraphsApiOptions } from "./agent-graphs.options"

/** The configurable-module base of the agent graph module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentGraphsApiOptions>().setClassMethodName("register").build()
