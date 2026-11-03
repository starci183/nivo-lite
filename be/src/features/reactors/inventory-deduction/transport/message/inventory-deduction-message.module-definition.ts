import { defineConfigurableModule } from "@starci/nest-kit"
import type { InventoryDeductionMessageOptions } from "./inventory-deduction-message.options"

/** The configurable-module base of the inventory-deduction-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InventoryDeductionMessageOptions>()
