import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { FireAgentScheduleQueueOptions } from "./fire-agent-schedule-queue.options"

type Host = ConfigurableModuleHost<FireAgentScheduleQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<FireAgentScheduleQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the fire-agent-schedule-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the fire-agent-schedule-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the fire-agent-schedule-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
