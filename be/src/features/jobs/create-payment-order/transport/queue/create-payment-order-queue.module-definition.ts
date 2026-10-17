import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CreatePaymentOrderQueueOptions } from "./create-payment-order-queue.options"

/** The configurable-module base of the create-payment-order-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CreatePaymentOrderQueueOptions>().setClassMethodName("register").build()
