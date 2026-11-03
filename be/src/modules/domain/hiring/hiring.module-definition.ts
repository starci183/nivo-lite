import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { HIRING_OPTIONS } from "./hiring.decorators"
import type { HiringOptions } from "./hiring.options"

/** The configurable-module base of the hiring capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<HiringOptions>({
    optionsInjectionToken: HIRING_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    HiringOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: HiringOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
