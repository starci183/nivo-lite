import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedBrainOptions } from "./seed-brain.options"

/** The configurable-module base of the seed-brain module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedBrainOptions>()
