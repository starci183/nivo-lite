import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CheckConnectionHealthQueueOptions } from "./check-connection-health-queue.options"

/** The configurable-module base of the check-connection-health-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CheckConnectionHealthQueueOptions>().setClassMethodName("register").build()
