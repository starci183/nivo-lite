import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloDeliveryQueueOptions } from "./zalo-delivery-queue.options"

/** The configurable-module base of the zalo-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloDeliveryQueueOptions>().setClassMethodName("register").build()
