import { defineConfigurableModule } from "@starci/nest-kit"
import type { ApiKeysApiOptions } from "./api-keys.options"

/** The configurable-module base of the api-keys module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ApiKeysApiOptions>()
