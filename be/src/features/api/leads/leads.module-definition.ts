import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadsApiOptions } from "./leads.options"

/** The configurable-module base of the leads module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadsApiOptions>()
