import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedAutomationsOptions } from "./seed-automations.options"

/** The configurable-module base of the seed-automations module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedAutomationsOptions>()
