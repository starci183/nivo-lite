import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { InventoryDeductionMessageOptions } from "./inventory-deduction-message.options"

type Host = ConfigurableModuleHost<InventoryDeductionMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<InventoryDeductionMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the inventory-deduction-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the inventory-deduction-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the inventory-deduction-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
