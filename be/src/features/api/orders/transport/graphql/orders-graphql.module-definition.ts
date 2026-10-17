import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrdersGraphqlOptions } from "./orders-graphql.options"

/** The configurable-module base of the orders-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrdersGraphqlOptions>().setClassMethodName("register").build()
