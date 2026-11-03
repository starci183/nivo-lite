import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayDeliveryQueueOptions } from "./sepay-delivery-queue.options"

/** The configurable-module base of the sepay-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayDeliveryQueueOptions>()
