import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrdersOptions } from "./orders.options"

/** The configurable-module base of the orders capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrdersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
