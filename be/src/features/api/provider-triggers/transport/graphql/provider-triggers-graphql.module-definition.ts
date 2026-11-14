import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProviderTriggersGraphqlOptions } from "./provider-triggers-graphql.options"

/** The configurable-module base of the provider triggers GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProviderTriggersGraphqlOptions>()
