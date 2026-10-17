import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyTillHttpOptions } from "./loyalty-till-http.options"

/** The configurable-module base of the loyalty-till-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LoyaltyTillHttpOptions>().setClassMethodName("register").build()
