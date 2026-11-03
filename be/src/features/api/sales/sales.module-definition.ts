import { defineConfigurableModule } from "@starci/nest-kit"
import type { SalesApiOptions } from "./sales.options"

/** The configurable-module base of the sales module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SalesApiOptions>()
