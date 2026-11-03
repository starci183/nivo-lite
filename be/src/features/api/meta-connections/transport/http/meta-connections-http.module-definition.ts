import { defineConfigurableModule } from "@starci/nest-kit"
import type { MetaConnectionsHttpOptions } from "./meta-connections-http.options"

/** The configurable-module base of the meta-connections-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<MetaConnectionsHttpOptions>()
