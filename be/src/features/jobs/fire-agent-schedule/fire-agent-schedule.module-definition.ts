import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { FireAgentScheduleOptions } from "./fire-agent-schedule.options"

/** The configurable-module base of the fire-agent-schedule module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<FireAgentScheduleOptions>().setClassMethodName("register").build()
