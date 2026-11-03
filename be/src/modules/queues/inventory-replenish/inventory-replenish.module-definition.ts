import { defineConfigurableModule } from "@starci/nest-kit"
import type { InventoryReplenishOptions } from "./inventory-replenish.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InventoryReplenishOptions>()
