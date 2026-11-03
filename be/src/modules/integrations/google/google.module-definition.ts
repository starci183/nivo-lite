import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { GOOGLE_OPTIONS } from "./google.decorators"
import type { GoogleOptions } from "./google.options"

/** The configurable-module base of the google integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<GoogleOptions>({ optionsInjectionToken: GOOGLE_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    GoogleOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: GoogleOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
