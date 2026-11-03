import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayDeliveryJobOptions } from "./sepay-delivery.options"

/** The configurable-module base of the sepay-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayDeliveryJobOptions>()
