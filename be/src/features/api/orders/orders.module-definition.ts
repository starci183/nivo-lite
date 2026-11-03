import { defineConfigurableModule } from "@starci/nest-kit"
import type { OrdersApiOptions } from "./orders.options"

/** The configurable-module base of the orders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OrdersApiOptions>()
