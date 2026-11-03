import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { PASSPORT_OPTIONS } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"

/** The configurable-module base of the passport integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<PassportOptions>({ optionsInjectionToken: PASSPORT_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PassportOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: PassportOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
