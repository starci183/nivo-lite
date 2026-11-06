import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedRecordsOptions } from "./seed-records.options"

/** The configurable-module base of the seed-records module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedRecordsOptions>()
