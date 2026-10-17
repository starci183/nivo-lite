import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloDeliveryJobOptions } from "./zalo-delivery.options"

/** The configurable-module base of the zalo-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloDeliveryJobOptions>().setClassMethodName("register").build()
