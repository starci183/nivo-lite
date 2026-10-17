import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryGraphqlOptions } from "./inventory-graphql.options"

/** The configurable-module base of the inventory-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InventoryGraphqlOptions>().setClassMethodName("register").build()
