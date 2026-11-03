import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import type { ConnectionsModuleOptions } from "./connections.options"

/** The configurable-module base of the connections capability. */
const definition = new ConfigurableModuleBuilder<ConnectionsModuleOptions>({
    optionsInjectionToken: CONNECTIONS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectionsModuleOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: ConnectionsModuleOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
