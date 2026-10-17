import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PromoGraphqlOptions } from "./promo-graphql.options"

/** The configurable-module base of the promo-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PromoGraphqlOptions>().setClassMethodName("register").build()
