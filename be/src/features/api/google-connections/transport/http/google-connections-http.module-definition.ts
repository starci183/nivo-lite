import { defineConfigurableModule } from "@starci/nest-kit"
import type { GoogleConnectionsHttpOptions } from "./google-connections-http.options"

/** The configurable-module base of the google-connections-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<GoogleConnectionsHttpOptions>()
