import { defineConfigurableModule } from "@starci/nest-kit"
import type { ApiKeysGraphqlOptions } from "./api-keys-graphql.options"

/** The configurable-module base of the api-keys-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ApiKeysGraphqlOptions>()
