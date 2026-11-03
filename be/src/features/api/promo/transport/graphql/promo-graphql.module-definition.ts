import { defineConfigurableModule } from "@starci/nest-kit"
import type { PromoGraphqlOptions } from "./promo-graphql.options"

/** The configurable-module base of the promo-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PromoGraphqlOptions>()
