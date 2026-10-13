import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PaymentOrderRequestsOptions } from "./payment-order-requests.options"

/** The configurable-module base of the order-requests capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PaymentOrderRequestsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
