import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"

/** The configurable-module base of the Zalo integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ZaloOptions>({ optionsInjectionToken: ZALO_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ZaloOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: ZaloOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
