import { defineConfigurableModule } from "@starci/nest-kit"
import type { InventoryApiOptions } from "./inventory.options"

/** The configurable-module base of the inventory module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InventoryApiOptions>()
