import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataHubGraphqlOptions } from "./data-hub-graphql.options"

/** The configurable-module base of the data-hub-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataHubGraphqlOptions>().setClassMethodName("register").build()
