import { defineConfigurableModule } from "@starci/nest-kit"
import type { InventoryDeductionOptions } from "./inventory-deduction.options"

/** The configurable-module base of the inventory-deduction module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InventoryDeductionOptions>()
