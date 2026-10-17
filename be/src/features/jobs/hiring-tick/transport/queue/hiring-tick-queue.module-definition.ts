import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HiringTickQueueOptions } from "./hiring-tick-queue.options"

/** The configurable-module base of the hiring-tick-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HiringTickQueueOptions>().setClassMethodName("register").build()
