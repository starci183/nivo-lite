import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryDeductionOptions } from "./inventory-deduction.options"

/** The configurable-module base of the inventory-deduction module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InventoryDeductionOptions>().setClassMethodName("register").build()
