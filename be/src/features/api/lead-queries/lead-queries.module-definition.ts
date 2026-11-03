import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadQueriesApiOptions } from "./lead-queries.options"

/** The configurable-module base of the lead-queries module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadQueriesApiOptions>()
