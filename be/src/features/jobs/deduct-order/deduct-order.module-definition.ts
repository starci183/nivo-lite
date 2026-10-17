import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeductOrderOptions } from "./deduct-order.options"

/** The configurable-module base of the deduct-order module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DeductOrderOptions>().setClassMethodName("register").build()
