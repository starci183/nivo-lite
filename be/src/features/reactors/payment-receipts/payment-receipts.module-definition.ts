import { defineConfigurableModule } from "@starci/nest-kit"
import type { PaymentReceiptsOptions } from "./payment-receipts.options"

/** The configurable-module base of the payment-receipts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PaymentReceiptsOptions>()
