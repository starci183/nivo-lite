import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedMediaOptions } from "./seed-media.options"

/** The configurable-module base of the seed-media module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedMediaOptions>()
