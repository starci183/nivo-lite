import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConnectionCommandsOptions } from "./connection-commands.options"

/** The configurable-module base of the connection-commands capability. */
const definition = new ConfigurableModuleBuilder<ConnectionCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectionCommandsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConnectionCommandsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
