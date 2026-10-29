import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PaymentReceiptsOptions } from "./payment-receipts.options"

/** The configurable-module base of the payment-receipts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PaymentReceiptsOptions>().setClassMethodName("register").build()
