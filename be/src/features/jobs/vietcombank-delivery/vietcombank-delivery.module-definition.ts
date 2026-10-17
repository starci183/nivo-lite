import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VietcombankDeliveryJobOptions } from "./vietcombank-delivery.options"

/** The configurable-module base of the vietcombank-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VietcombankDeliveryJobOptions>().setClassMethodName("register").build()
