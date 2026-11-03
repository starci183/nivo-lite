import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { InventoryReplenishOptions } from "./inventory-replenish.options"

/** The configurable-module base of the inventory-replenish module. */
const definition = new ConfigurableModuleBuilder<InventoryReplenishOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<InventoryReplenishOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: InventoryReplenishOptions = definition.OPTIONS_TYPE
