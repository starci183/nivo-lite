import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ResponsibilitiesOptions } from "./responsibilities.options"

/** The configurable-module base of the responsibilities capability. */
const definition = new ConfigurableModuleBuilder<ResponsibilitiesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ResponsibilitiesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ResponsibilitiesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
