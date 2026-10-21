import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunMarketingTickQueueOptions } from "./run-marketing-tick-queue.options"

/** The configurable-module base of the run-marketing-tick-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunMarketingTickQueueOptions>().setClassMethodName("register").build()
