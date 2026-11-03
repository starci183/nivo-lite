import { defineConfigurableModule } from "@starci/nest-kit"
import type { MetaConnectionsApiOptions } from "./meta-connections.options"

/** The configurable-module base of the meta-connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<MetaConnectionsApiOptions>()
