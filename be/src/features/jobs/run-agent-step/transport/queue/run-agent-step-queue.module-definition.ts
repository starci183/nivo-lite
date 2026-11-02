import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAgentStepQueueOptions } from "./run-agent-step-queue.options"

/** The configurable-module base of the run-agent-step-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAgentStepQueueOptions>().setClassMethodName("register").build()
