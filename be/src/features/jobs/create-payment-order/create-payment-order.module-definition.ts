import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CreatePaymentOrderOptions } from "./create-payment-order.options"

/** The configurable-module base of the create-payment-order module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CreatePaymentOrderOptions>().setClassMethodName("register").build()
