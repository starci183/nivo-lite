import { defineConfigurableModule } from "@starci/nest-kit"
import type { CreatePaymentOrderQueueOptions } from "./create-payment-order-queue.options"

/** The configurable-module base of the create-payment-order-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CreatePaymentOrderQueueOptions>()
