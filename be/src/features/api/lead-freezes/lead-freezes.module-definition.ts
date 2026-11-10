import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadFreezesApiOptions } from "./lead-freezes.options"

/** The configurable-module base of the lead-freezes module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadFreezesApiOptions>()
