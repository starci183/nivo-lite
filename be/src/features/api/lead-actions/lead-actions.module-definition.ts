import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadActionsApiOptions } from "./lead-actions.options"

/** The configurable-module base of the lead-actions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadActionsApiOptions>()
