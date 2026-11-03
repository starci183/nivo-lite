import { defineConfigurableModule } from "@starci/nest-kit"
import type { MetaDeliveryQueueOptions } from "./meta-delivery-queue.options"

/** The configurable-module base of the meta-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<MetaDeliveryQueueOptions>()
