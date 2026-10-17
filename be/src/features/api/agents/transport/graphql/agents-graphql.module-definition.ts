import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentsGraphqlOptions } from "./agents-graphql.options"

/** The configurable-module base of the agents-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentsGraphqlOptions>().setClassMethodName("register").build()
