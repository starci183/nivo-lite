import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryDeductionMessageOptions } from "./inventory-deduction-message.options"

/** The configurable-module base of the inventory-deduction-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InventoryDeductionMessageOptions>().setClassMethodName("register").build()
