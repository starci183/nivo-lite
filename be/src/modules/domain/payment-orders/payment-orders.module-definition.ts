import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PaymentOrdersOptions } from "./payment-orders.options"

/** The configurable-module base of the payment-orders capability. */
const definition = new ConfigurableModuleBuilder<PaymentOrdersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PaymentOrdersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PaymentOrdersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
