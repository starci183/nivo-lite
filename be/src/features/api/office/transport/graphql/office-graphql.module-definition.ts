import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeGraphqlOptions } from "./office-graphql.options"

/** The configurable-module base of the office-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OfficeGraphqlOptions>().setClassMethodName("register").build()
