import { defineConfigurableModule } from "@starci/nest-kit"
import type { ZaloDeliveryJobOptions } from "./zalo-delivery.options"

/** The configurable-module base of the zalo-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ZaloDeliveryJobOptions>()
