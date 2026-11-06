import { defineCapabilityModule } from "@starci/nest-kit"
import type { PaymentTransactionsOptions } from "./payment-transactions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PaymentTransactionsOptions>()
