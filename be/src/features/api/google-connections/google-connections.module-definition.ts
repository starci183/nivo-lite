import { defineConfigurableModule } from "@starci/nest-kit"
import type { GoogleConnectionsApiOptions } from "./google-connections.options"

/** The configurable-module base of the google-connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<GoogleConnectionsApiOptions>()
