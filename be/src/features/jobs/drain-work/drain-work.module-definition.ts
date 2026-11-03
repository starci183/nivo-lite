import { defineConfigurableModule } from "@starci/nest-kit"
import type { DrainWorkOptions } from "./drain-work.options"

/** The configurable-module base of the drain-work module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DrainWorkOptions>()
