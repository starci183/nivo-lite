import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConnectionGrantsOptions } from "./connection-grants.options"

/** The configurable-module base of the connection-grants capability. */
const definition = new ConfigurableModuleBuilder<ConnectionGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectionGrantsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConnectionGrantsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
