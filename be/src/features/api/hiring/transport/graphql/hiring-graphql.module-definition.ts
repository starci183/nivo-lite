import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HiringGraphqlOptions } from "./hiring-graphql.options"

/** The configurable-module base of the hiring-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HiringGraphqlOptions>().setClassMethodName("register").build()
