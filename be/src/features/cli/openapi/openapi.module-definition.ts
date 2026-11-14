import { defineConfigurableModule } from "@starci/nest-kit"
import type { OpenApiCliOptions } from "./openapi.options"

/** The configurable-module base of the openapi module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OpenApiCliOptions>()
