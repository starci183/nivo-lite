import { defineCapabilityModule } from "@starci/nest-kit"
import type { PaymentOrderRequestsOptions } from "./payment-order-requests.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PaymentOrderRequestsOptions>()
