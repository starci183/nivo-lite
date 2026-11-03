import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayHttpOptions } from "./sepay-http.options"

/** The configurable-module base of the sepay-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayHttpOptions>()
