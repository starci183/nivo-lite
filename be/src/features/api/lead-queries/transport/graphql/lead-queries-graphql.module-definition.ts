import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadQueriesGraphqlOptions } from "./lead-queries-graphql.options"

/** The configurable-module base of the lead-queries-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadQueriesGraphqlOptions>()
