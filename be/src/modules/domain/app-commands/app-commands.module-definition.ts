import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AppCommandsOptions } from "./app-commands.options"

/** The configurable-module base of the app-commands capability. */
const definition = new ConfigurableModuleBuilder<AppCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AppCommandsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AppCommandsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
