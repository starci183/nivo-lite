import { defineConfigurableModule } from "@starci/nest-kit"
import type { ModuleJobsOptions } from "./module-jobs.options"

/** The configurable-module base of the module-jobs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ModuleJobsOptions>()
