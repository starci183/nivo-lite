import { defineConfigurableModule } from "@starci/nest-kit"
import type { ExternalApiHttpOptions } from "./external-api-http.options"

/** The configurable-module base of the external-api-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ExternalApiHttpOptions>()
