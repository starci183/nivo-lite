import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DecisionsGraphqlOptions } from "./decisions-graphql.options"

/** The configurable-module base of the decisions-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DecisionsGraphqlOptions>().setClassMethodName("register").build()
