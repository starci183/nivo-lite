import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BillingApiOptions } from "./billing.options"

/** The configurable-module base of the billing module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BillingApiOptions>().setClassMethodName("register").build()
