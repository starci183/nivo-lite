import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InventoryOptions } from "./inventory.options"

/** The configurable-module base of the inventory capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InventoryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
