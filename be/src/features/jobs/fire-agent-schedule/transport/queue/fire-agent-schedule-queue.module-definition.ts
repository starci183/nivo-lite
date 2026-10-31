import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { FireAgentScheduleQueueOptions } from "./fire-agent-schedule-queue.options"

/** The configurable-module base of the fire-agent-schedule-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<FireAgentScheduleQueueOptions>().setClassMethodName("register").build()
