import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AdminGraphqlOptions } from "./admin-graphql.options"

/** The configurable-module base of the admin-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AdminGraphqlOptions>().setClassMethodName("register").build()
