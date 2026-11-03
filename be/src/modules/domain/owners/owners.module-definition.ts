import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { OWNERS_OPTIONS } from "./owners.decorators"
import type { OwnersOptions } from "./owners.options"

/** The configurable-module base of the owners capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<OwnersOptions>({
    optionsInjectionToken: OWNERS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OwnersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: OwnersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
