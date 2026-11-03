import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { InventoryDeductionOptions } from "./inventory-deduction.options"

type Host = ConfigurableModuleHost<InventoryDeductionOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<InventoryDeductionOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the inventory-deduction module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the inventory-deduction module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the inventory-deduction module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
