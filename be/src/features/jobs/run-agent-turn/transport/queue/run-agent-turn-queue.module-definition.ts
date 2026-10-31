import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAgentTurnQueueOptions } from "./run-agent-turn-queue.options"

/** The configurable-module base of the run-agent-turn-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAgentTurnQueueOptions>().setClassMethodName("register").build()
