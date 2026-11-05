import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkbenchApiOptions } from "./workbench.options"

/** The configurable-module base of the workbench module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkbenchApiOptions>()
