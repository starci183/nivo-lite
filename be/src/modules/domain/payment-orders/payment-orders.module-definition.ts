import { defineCapabilityModule } from "@starci/nest-kit"
import type { PaymentOrdersOptions } from "./payment-orders.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PaymentOrdersOptions>()
