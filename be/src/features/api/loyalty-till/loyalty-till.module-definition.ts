import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyTillApiOptions } from "./loyalty-till.options"

/** The configurable-module base of the loyalty-till module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LoyaltyTillApiOptions>().setClassMethodName("register").build()
