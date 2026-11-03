import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OfficeRoomsOptions } from "./office-rooms.options"

/** The configurable-module base of the office rooms capability. */
const definition = new ConfigurableModuleBuilder<OfficeRoomsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OfficeRoomsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OfficeRoomsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
