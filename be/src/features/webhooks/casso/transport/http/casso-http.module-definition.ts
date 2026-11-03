import { defineConfigurableModule } from "@starci/nest-kit"
import type { CassoHttpOptions } from "./casso-http.options"

/** The configurable-module base of the casso-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CassoHttpOptions>()
