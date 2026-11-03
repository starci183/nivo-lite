import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadActionsGraphqlOptions } from "./lead-actions-graphql.options"

/** The configurable-module base of the lead-actions-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadActionsGraphqlOptions>()
