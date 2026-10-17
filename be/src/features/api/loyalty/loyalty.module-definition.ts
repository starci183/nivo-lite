import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyApiOptions } from "./loyalty.options"

/** The configurable-module base of the loyalty module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LoyaltyApiOptions>().setClassMethodName("register").build()
