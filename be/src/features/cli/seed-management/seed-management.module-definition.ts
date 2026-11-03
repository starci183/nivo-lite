import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedManagementOptions } from "./seed-management.options"

/** The configurable-module base of the seed-management module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedManagementOptions>()
