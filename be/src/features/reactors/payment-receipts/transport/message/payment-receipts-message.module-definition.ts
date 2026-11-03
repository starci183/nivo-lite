import { defineConfigurableModule } from "@starci/nest-kit"
import type { PaymentReceiptsMessageOptions } from "./payment-receipts-message.options"

/** The configurable-module base of the payment-receipts-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PaymentReceiptsMessageOptions>()
