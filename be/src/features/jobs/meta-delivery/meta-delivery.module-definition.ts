import { defineConfigurableModule } from "@starci/nest-kit"
import type { MetaDeliveryJobOptions } from "./meta-delivery.options"

/** The configurable-module base of the meta-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<MetaDeliveryJobOptions>()
