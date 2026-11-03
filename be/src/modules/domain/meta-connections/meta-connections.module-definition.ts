import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MetaConnectionsOptions } from "./meta-connections.options"

/** The configurable-module base of the meta-connections capability. */
const definition = new ConfigurableModuleBuilder<MetaConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MetaConnectionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MetaConnectionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
