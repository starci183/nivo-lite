import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PaymentReceiptsMessageOptions } from "./payment-receipts-message.options"

/** The configurable-module base of the payment-receipts-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PaymentReceiptsMessageOptions>().setClassMethodName("register").build()
