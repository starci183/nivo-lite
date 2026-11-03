import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayConnectionApiOptions } from "./sepay-connection.options"

/** The configurable-module base of the sepay-connection module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayConnectionApiOptions>()
