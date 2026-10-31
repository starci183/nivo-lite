import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentWorkApiOptions } from "./agent-work.options"

/** The configurable-module base of the agent-work feature module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentWorkApiOptions>().setClassMethodName("register").build()
