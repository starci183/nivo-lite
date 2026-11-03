import { defineConfigurableModule } from "@starci/nest-kit"
import type { PayosHttpOptions } from "./payos-http.options"

/** The configurable-module base of the payos-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PayosHttpOptions>()
