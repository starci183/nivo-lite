import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicLoyaltyGraphqlOptions } from "./public-loyalty-graphql.options"

/** The configurable-module base of the public-loyalty-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicLoyaltyGraphqlOptions>()
