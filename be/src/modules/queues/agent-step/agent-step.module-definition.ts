import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentStepOptions } from "./agent-step.options"

/** The configurable-module base of the agent-step queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentStepOptions>().setClassMethodName("register").build()
