import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OrdersOptions } from "./orders.options"

/** The configurable-module base of the orders capability. */
const definition = new ConfigurableModuleBuilder<OrdersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OrdersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OrdersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
