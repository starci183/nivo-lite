import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { InventoryOptions } from "./inventory.options"

/** The configurable-module base of the inventory capability. */
const definition = new ConfigurableModuleBuilder<InventoryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    InventoryOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: InventoryOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
