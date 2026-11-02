import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAgentStepOptions } from "./run-agent-step.options"

/** The configurable-module base of the run-agent-step module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAgentStepOptions>().setClassMethodName("register").build()
