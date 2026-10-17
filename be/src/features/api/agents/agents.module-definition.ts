import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentsApiOptions } from "./agents.options"

/** The configurable-module base of the agents module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentsApiOptions>().setClassMethodName("register").build()
