import { defineConfigurableModule } from "@starci/nest-kit"
import type { ResetWorkflowsOptions } from "./reset-workflows.options"

/** The configurable-module base of the reset-workflows module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ResetWorkflowsOptions>()
