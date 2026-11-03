import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectionsApiOptions } from "./connections.options"

/** The configurable-module base of the connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectionsApiOptions>()
