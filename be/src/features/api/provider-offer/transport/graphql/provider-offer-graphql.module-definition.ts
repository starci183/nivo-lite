import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProviderOfferGraphqlOptions } from "./provider-offer-graphql.options"

/** The configurable-module base of the provider offer GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProviderOfferGraphqlOptions>()
