import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedModulesOptions } from "./seed-modules.options"

/** The configurable-module base of the seed-modules module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedModulesOptions>()
