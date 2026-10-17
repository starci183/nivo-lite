import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunShiftsAlertsQueueOptions } from "./run-shifts-alerts-queue.options"

/** The configurable-module base of the run-shifts-alerts-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunShiftsAlertsQueueOptions>().setClassMethodName("register").build()
