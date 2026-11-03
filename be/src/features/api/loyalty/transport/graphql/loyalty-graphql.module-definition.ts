import { defineConfigurableModule } from "@starci/nest-kit"
import type { LoyaltyGraphqlOptions } from "./loyalty-graphql.options"

/** The configurable-module base of the loyalty-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LoyaltyGraphqlOptions>()
