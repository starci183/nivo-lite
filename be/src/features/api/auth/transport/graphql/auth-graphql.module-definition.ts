import { defineConfigurableModule } from "@starci/nest-kit"
import type { AuthGraphqlOptions } from "./auth-graphql.options"

/** The configurable-module base of the auth-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AuthGraphqlOptions>()
