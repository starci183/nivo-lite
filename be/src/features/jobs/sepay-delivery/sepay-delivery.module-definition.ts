import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayDeliveryJobOptions } from "./sepay-delivery.options"

/** The configurable-module base of the sepay-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SepayDeliveryJobOptions>().setClassMethodName("register").build()
