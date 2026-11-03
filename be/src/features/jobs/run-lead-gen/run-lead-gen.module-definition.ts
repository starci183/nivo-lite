import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunLeadGenOptions } from "./run-lead-gen.options"

/** The configurable-module base of the run-lead-gen module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunLeadGenOptions>()
