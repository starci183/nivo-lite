import { defineConfigurableModule } from "@starci/nest-kit"
import type { InventoryGraphqlOptions } from "./inventory-graphql.options"

/** The configurable-module base of the inventory-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InventoryGraphqlOptions>()
