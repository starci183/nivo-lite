import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RendersGraphqlOptions } from "./renders-graphql.options"

/** The configurable-module base of the renders-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RendersGraphqlOptions>().setClassMethodName("register").build()
