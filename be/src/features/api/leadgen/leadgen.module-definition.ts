import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadGenApiOptions } from "./leadgen.options"

/** The configurable-module base of the leadgen module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadGenApiOptions>()
