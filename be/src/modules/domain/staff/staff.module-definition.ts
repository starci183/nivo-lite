import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { StaffOptions } from "./staff.options"

/** The configurable module base of the staff capability. */
const definition = new ConfigurableModuleBuilder<StaffOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    StaffOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: StaffOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
