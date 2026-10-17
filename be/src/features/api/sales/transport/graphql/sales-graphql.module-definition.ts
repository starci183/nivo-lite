import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesGraphqlOptions } from "./sales-graphql.options"

/** The configurable-module base of the sales-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SalesGraphqlOptions>().setClassMethodName("register").build()
