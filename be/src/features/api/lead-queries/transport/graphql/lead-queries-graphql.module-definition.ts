import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadQueriesGraphqlOptions } from "./lead-queries-graphql.options"

/** The configurable-module base of the lead-queries-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadQueriesGraphqlOptions>().setClassMethodName("register").build()
