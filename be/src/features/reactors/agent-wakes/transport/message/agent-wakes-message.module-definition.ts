import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentWakesMessageOptions } from "./agent-wakes-message.options"

/** The configurable-module base of the agent-wakes-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentWakesMessageOptions>().setClassMethodName("register").build()
