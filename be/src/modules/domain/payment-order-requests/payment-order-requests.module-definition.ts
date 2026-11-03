import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PaymentOrderRequestsOptions } from "./payment-order-requests.options"

/** The configurable-module base of the order-requests capability. */
const definition = new ConfigurableModuleBuilder<PaymentOrderRequestsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PaymentOrderRequestsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PaymentOrderRequestsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
