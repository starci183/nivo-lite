import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AppErrorsOptions } from "./app-errors.options"

/** The configurable-module base of the app-errors capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AppErrorsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AppErrorsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AppErrorsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
