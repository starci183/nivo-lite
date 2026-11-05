import { defineConfigurableModule } from "@starci/nest-kit"
import type { ParkedJobsOptions } from "./parked-jobs.options"

/** The configurable-module base of the parked-jobs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ParkedJobsOptions>()
