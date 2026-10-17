import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyGraphqlOptions } from "./loyalty-graphql.options"

/** The configurable-module base of the loyalty-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LoyaltyGraphqlOptions>().setClassMethodName("register").build()
