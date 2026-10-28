import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloConnectionPageGraphqlOptions } from "./zalo-connection-page-graphql.options"

/** The configurable-module base of the zalo-connection-page-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloConnectionPageGraphqlOptions>().setClassMethodName("register").build()
