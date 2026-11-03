import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { ERRORS_OPTIONS } from "./errors.decorators"
import type { ErrorsOptions } from "./errors.options"

/** The configurable-module base of the errors capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ErrorsOptions>({ optionsInjectionToken: ERRORS_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ErrorsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: ErrorsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
