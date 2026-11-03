import { defineConfigurableModule } from "@starci/nest-kit"
import type { ExternalApiOptions } from "./external-api.options"

/** The configurable-module base of the external-api module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ExternalApiOptions>()
