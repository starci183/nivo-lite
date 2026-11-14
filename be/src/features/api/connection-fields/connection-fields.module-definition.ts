import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectionFieldsApiOptions } from "./connection-fields.options"

/** The configurable-module base of the connection form module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectionFieldsApiOptions>()
