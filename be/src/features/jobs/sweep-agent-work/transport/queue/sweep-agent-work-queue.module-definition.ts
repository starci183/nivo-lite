import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SweepAgentWorkQueueOptions } from "./sweep-agent-work-queue.options"

/** The configurable-module base of the sweep-agent-work-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SweepAgentWorkQueueOptions>().setClassMethodName("register").build()
