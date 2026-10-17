import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentToolsApiOptions } from "./agent-tools.options"

/** The configurable-module base of the agent-tools module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentToolsApiOptions>().setClassMethodName("register").build()
