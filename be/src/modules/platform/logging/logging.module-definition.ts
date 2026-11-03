import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoggingOptions } from "./logging.options"

/** The configurable-module base of the logging capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<LoggingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoggingOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoggingOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
