import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountGraphqlOptions } from "./account-graphql.options"

/** The configurable-module base of the account-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AccountGraphqlOptions>().setClassMethodName("register").build()
