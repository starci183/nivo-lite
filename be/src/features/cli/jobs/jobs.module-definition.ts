import { defineConfigurableModule } from "@starci/nest-kit"
import type { CliJobsOptions } from "./jobs.options"

/** The configurable-module base of the jobs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CliJobsOptions>()
