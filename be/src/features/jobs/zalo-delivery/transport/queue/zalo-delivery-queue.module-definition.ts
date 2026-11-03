import { defineConfigurableModule } from "@starci/nest-kit"
import type { ZaloDeliveryQueueOptions } from "./zalo-delivery-queue.options"

/** The configurable-module base of the zalo-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ZaloDeliveryQueueOptions>()
