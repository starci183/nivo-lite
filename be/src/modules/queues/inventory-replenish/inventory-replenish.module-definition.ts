import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryReplenishOptions } from "./inventory-replenish.options"

/** The configurable-module base of the inventory-replenish module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InventoryReplenishOptions>().setClassMethodName("register").build()
