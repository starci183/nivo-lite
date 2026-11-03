import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunLeadActionOptions } from "./run-lead-action.options"

/** The configurable-module base of the run-lead-action module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunLeadActionOptions>()
