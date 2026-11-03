import { defineCapabilityModule } from "@starci/nest-kit"
import type { InventoryOptions } from "./inventory.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<InventoryOptions>()
