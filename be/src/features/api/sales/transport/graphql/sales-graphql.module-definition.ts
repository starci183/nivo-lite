import { defineConfigurableModule } from "@starci/nest-kit"
import type { SalesGraphqlOptions } from "./sales-graphql.options"

/** The configurable-module base of the sales-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SalesGraphqlOptions>()
