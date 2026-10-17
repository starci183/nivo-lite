import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeductOrderQueueOptions } from "./deduct-order-queue.options"

/** The configurable-module base of the deduct-order-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DeductOrderQueueOptions>().setClassMethodName("register").build()
