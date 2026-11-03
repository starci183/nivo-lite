import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConnectionLifecycleOptions } from "./connection-lifecycle.options"

/** The configurable-module base of the connection-lifecycle capability. */
const definition = new ConfigurableModuleBuilder<ConnectionLifecycleOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectionLifecycleOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConnectionLifecycleOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
