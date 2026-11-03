import { defineConfigurableModule } from "@starci/nest-kit"
import type { BillingGraphqlOptions } from "./billing-graphql.options"

/** The configurable-module base of the billing-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BillingGraphqlOptions>()
