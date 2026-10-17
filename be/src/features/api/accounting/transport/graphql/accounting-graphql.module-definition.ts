import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountingGraphqlOptions } from "./accounting-graphql.options"

/** The configurable-module base of the accounting-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AccountingGraphqlOptions>().setClassMethodName("register").build()
