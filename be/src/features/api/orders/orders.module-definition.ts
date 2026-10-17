import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrdersApiOptions } from "./orders.options"

/** The configurable-module base of the orders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrdersApiOptions>().setClassMethodName("register").build()
