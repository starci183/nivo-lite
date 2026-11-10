import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadFreezesGraphqlOptions } from "./lead-freezes-graphql.options"

/** The configurable-module base of the lead-freezes-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadFreezesGraphqlOptions>()
