import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BillingGraphqlOptions } from "./billing-graphql.options"

/** The configurable-module base of the billing-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BillingGraphqlOptions>().setClassMethodName("register").build()
