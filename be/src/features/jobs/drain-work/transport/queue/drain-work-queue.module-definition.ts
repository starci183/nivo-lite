import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DrainWorkQueueOptions } from "./drain-work-queue.options"

/** The configurable-module base of the drain-work-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DrainWorkQueueOptions>().setClassMethodName("register").build()
