import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { FlowsGraphqlOptions } from "./flows-graphql.options"

/** The configurable-module base of the flows-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<FlowsGraphqlOptions>().setClassMethodName("register").build()
