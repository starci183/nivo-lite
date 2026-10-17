import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadActionsGraphqlOptions } from "./lead-actions-graphql.options"

/** The configurable-module base of the lead-actions-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadActionsGraphqlOptions>().setClassMethodName("register").build()
