import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentWakesOptions } from "./agent-wakes.options"

/** The configurable-module base of the agent-wakes module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentWakesOptions>().setClassMethodName("register").build()
