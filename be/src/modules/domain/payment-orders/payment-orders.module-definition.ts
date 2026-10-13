import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PaymentOrdersOptions } from "./payment-orders.options"

/** The configurable-module base of the payment-orders capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PaymentOrdersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
