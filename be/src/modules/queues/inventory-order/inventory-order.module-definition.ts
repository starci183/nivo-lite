import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryOrderOptions } from "./inventory-order.options"

/** The configurable-module base of the inventory-order module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InventoryOrderOptions>().setClassMethodName("register").build()
