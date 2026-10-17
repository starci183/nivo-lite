import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VietcombankDeliveryQueueOptions } from "./vietcombank-delivery-queue.options"

/** The configurable-module base of the vietcombank-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VietcombankDeliveryQueueOptions>().setClassMethodName("register").build()
