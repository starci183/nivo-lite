import { defineConfigurableModule } from "@starci/nest-kit"
import type { OrdersGraphqlOptions } from "./orders-graphql.options"

/** The configurable-module base of the orders-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OrdersGraphqlOptions>()
