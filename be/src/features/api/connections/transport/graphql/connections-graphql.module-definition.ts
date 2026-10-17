import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionsGraphqlOptions } from "./connections-graphql.options"

/** The configurable-module base of the connections-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionsGraphqlOptions>().setClassMethodName("register").build()
