import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ShiftsOptions } from "./shifts.options"

/** The configurable-module base of the shifts capability. */
const definition = new ConfigurableModuleBuilder<ShiftsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ShiftsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ShiftsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
